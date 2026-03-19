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
  size_t n = receiveResponse(buf, sizeof(buf), 1000);
  if (n < 3) return false;
  if (buf[0] != 0x62 || buf[1] != (did >> 8) || buf[2] != (did & 0xFF)) return false;
  n -= 3;
  if (n > maxLen) n = maxLen;
  memcpy(outData, buf + 3, n);
  if (outLen) *outLen = n;
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
