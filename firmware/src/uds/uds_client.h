#ifndef UDS_CLIENT_H
#define UDS_CLIENT_H

#include <cstddef>
#include <cstdint>

namespace ev_diag {

// Initialize UDS client with request and response CAN IDs (e.g. 0x7DF, 0x7E8).
void udsClientInit(uint32_t requestId, uint32_t responseId);

// Send UDS request (single frame): build ISO-TP single frame and send via CAN.
bool sendRequest(const uint8_t* req, size_t len);

// Receive UDS response (single frame, timeout ms). Returns payload length or 0 on timeout/error.
size_t receiveResponse(uint8_t* out, size_t maxLen, uint32_t timeoutMs);

// Receive UDS response with ISO-TP multi-frame (single, first+consecutive). Returns total payload length or 0.
size_t receiveResponseLong(uint8_t* out, size_t maxLen, uint32_t timeoutMs);

// High-level services (build request, send, receive, return success)
bool diagnosticSessionControl(uint8_t subFunc);
bool testerPresent();
bool readDataByIdentifier(uint16_t did, uint8_t* outData, size_t maxLen, size_t* outLen);
// Read VIN via UDS (DID). Writes up to 18 bytes (17 chars + NUL) into outVin. Returns true if 17 chars read.
bool readVin(uint16_t didVin, char* outVin, size_t outSize);
bool readDTC(uint8_t* outData, size_t maxLen, size_t* outLen);
bool clearDTC();

}  // namespace ev_diag

#endif  // UDS_CLIENT_H
