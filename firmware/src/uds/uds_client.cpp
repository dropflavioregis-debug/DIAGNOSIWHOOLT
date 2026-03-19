#include "uds_client.h"
#include "uds_services.h"
#include "can/can_driver.h"
#include <cstring>

namespace ev_diag {

static uint32_t s_requestId = uds::OBD_REQUEST_ID;
static uint32_t s_responseId = uds::OBD_RESPONSE_ID;

void udsClientInit(uint32_t requestId, uint32_t responseId) {
  s_requestId = requestId;
  s_responseId = responseId;
}

// ISO-TP single frame: PCI = 0x0N (N = data length, 0-7 bytes)
static const size_t MAX_SINGLE_FRAME_PAYLOAD = 7;

bool sendRequest(const uint8_t* req, size_t len) {
  if (!canIsStarted() || req == nullptr || len > MAX_SINGLE_FRAME_PAYLOAD) return false;

  uint8_t frame[8];
  frame[0] = 0x00 | (len & 0x0F);
  memcpy(frame + 1, req, len);
  if (len < 7) memset(frame + 1 + len, 0, 7 - len);

  return canSend(s_requestId, 8, frame);
}

size_t receiveResponse(uint8_t* out, size_t maxLen, uint32_t timeoutMs) {
  if (!canIsStarted() || out == nullptr || maxLen == 0) return 0;

  const unsigned long deadline = millis() + timeoutMs;
  while (millis() < deadline) {
    uint32_t id;
    uint8_t len;
    uint8_t data[8];
    if (canReceive(&id, &len, data, sizeof(data)) && id == s_responseId && len >= 1) {
      uint8_t pci = data[0];
      size_t payloadLen = pci & 0x0F;
      if (payloadLen > 7) payloadLen = 0;
      if (payloadLen > maxLen) payloadLen = maxLen;
      memcpy(out, data + 1, payloadLen);
      return payloadLen;
    }
    delay(2);
  }
  return 0;
}

// ISO-TP: single frame 0x0N (N bytes), or first frame 0x1N + byte1 = total length (12 bits), then consecutive 0x2(SN)
size_t receiveResponseLong(uint8_t* out, size_t maxLen, uint32_t timeoutMs) {
  if (!canIsStarted() || out == nullptr || maxLen == 0) return 0;

  const unsigned long deadline = millis() + timeoutMs;
  uint32_t id;
  uint8_t len;
  uint8_t data[8];

  while (millis() < deadline) {
    if (!canReceive(&id, &len, data, sizeof(data)) || id != s_responseId || len < 1) {
      delay(2);
      continue;
    }
    uint8_t pci = data[0];
    size_t pciType = (pci >> 4) & 0x0F;

    if (pciType == 0) {
      // Single frame: 0x0N, N = payload length (0-7)
      size_t payloadLen = pci & 0x0F;
      if (payloadLen > maxLen) payloadLen = maxLen;
      memcpy(out, data + 1, payloadLen);
      return payloadLen;
    }

    if (pciType != 1 || len < 2) continue;

    // First frame: 0x1N, N = high nibble of 12-bit length; data[1] = low byte
    size_t totalLen = (static_cast<size_t>(pci & 0x0F) << 8) | data[1];
    if (totalLen > maxLen) totalLen = maxLen;
    if (totalLen <= 6) {
      memcpy(out, data + 2, totalLen);
      return totalLen;
    }
    memcpy(out, data + 2, 6);
    size_t received = 6;
    uint8_t expectedSn = 1;

    // ISO 15765-2: send Flow Control (ContinueToSend, block size 0, separation 0) so ECU sends Consecutive Frames
    {
      uint8_t fcFrame[8] = { 0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
      canSend(s_requestId, 8, fcFrame);
    }

    while (received < totalLen && millis() < deadline) {
      if (!canReceive(&id, &len, data, sizeof(data)) || id != s_responseId || len < 1) {
        delay(2);
        continue;
      }
      pci = data[0];
      if ((pci >> 4) != 2) continue;  // Consecutive frame 0x2N
      uint8_t sn = pci & 0x0F;
      if (sn != expectedSn) continue;
      expectedSn = (expectedSn + 1) & 0x0F;  // ISO 15765-2: SN 1..15 then 0
      size_t toCopy = totalLen - received;
      if (toCopy > 7) toCopy = 7;
      memcpy(out + received, data + 1, toCopy);
      received += toCopy;
    }
    return received;
  }
  return 0;
}

bool diagnosticSessionControl(uint8_t subFunc) {
  uint8_t req[2] = { uds::SID_DIAGNOSTIC_SESSION_CONTROL, subFunc };
  if (!sendRequest(req, 2)) return false;
  uint8_t resp[4];
  return receiveResponse(resp, sizeof(resp), 1000) >= 2 && resp[0] == 0x50 && resp[1] == subFunc;
}

bool testerPresent() {
  uint8_t req[2] = { uds::SID_TESTER_PRESENT, 0x00 };
  if (!sendRequest(req, 2)) return false;
  uint8_t resp[4];
  return receiveResponse(resp, sizeof(resp), 500) >= 2 && resp[0] == 0x7E;
}

bool readDataByIdentifier(uint16_t did, uint8_t* outData, size_t maxLen, size_t* outLen) {
  uint8_t req[3] = {
    uds::SID_READ_DATA_IDENTIFIER,
    (uint8_t)(did >> 8),
    (uint8_t)(did & 0xFF)
  };
  if (!sendRequest(req, 3)) return false;
  uint8_t buf[64];
  size_t n = receiveResponseLong(buf, sizeof(buf), 2000);
  if (n < 3) return false;
  if (buf[0] != 0x62 || buf[1] != (did >> 8) || buf[2] != (did & 0xFF)) return false;
  n -= 3;
  if (n > maxLen) n = maxLen;
  memcpy(outData, buf + 3, n);
  if (outLen) *outLen = n;
  return true;
}

static bool isVinChar(char c) {
  return (c >= '0' && c <= '9') || ((c >= 'A' && c <= 'Z') && c != 'I' && c != 'O' && c != 'Q');
}

bool readVin(uint16_t didVin, char* outVin, size_t outSize) {
  if (!outVin || outSize < 18) return false;
  outVin[0] = '\0';
  uint8_t raw[24];
  size_t rawLen = 0;
  if (!readDataByIdentifier(didVin, raw, sizeof(raw), &rawLen) || rawLen < 17)
    return false;
  for (size_t i = 0; i < 17 && i < rawLen; i++) {
    char c = static_cast<char>(raw[i]);
    if (!isVinChar(c)) c = ' ';
    outVin[i] = c;
  }
  outVin[17] = '\0';
  return true;
}

bool readDTC(uint8_t* outData, size_t maxLen, size_t* outLen) {
  uint8_t req[3] = { uds::SID_READ_DTC, uds::RDTC_REPORT_DTC_BY_STATUS_MASK, uds::RDTC_STATUS_MASK_ALL };
  if (!sendRequest(req, 3)) return false;
  uint8_t buf[64];
  size_t n = receiveResponse(buf, sizeof(buf), 2000);
  if (n < 2) return false;
  if (buf[0] != 0x59) return false;
  n -= 2;
  if (n > maxLen) n = maxLen;
  memcpy(outData, buf + 2, n);
  if (outLen) *outLen = n;
  return true;
}

bool clearDTC() {
  uint8_t req[4] = { uds::SID_CLEAR_DTC, 0x00, uds::CDTC_GROUP_MASK_ALL, uds::CDTC_GROUP_MASK_ALL };
  if (!sendRequest(req, 4)) return false;
  uint8_t resp[4];
  return receiveResponse(resp, sizeof(resp), 1000) >= 2 && resp[0] == 0x54;
}

}  // namespace ev_diag
