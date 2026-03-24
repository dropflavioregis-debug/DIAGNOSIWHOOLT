#ifndef API_CLIENT_H
#define API_CLIENT_H

#include <cstddef>
#include <cstdint>

namespace ev_diag {

// POST body to /api/ingest. Returns true if response 2xx.
bool postIngest(const char* serverUrl, const char* apiKey, const char* jsonBody);

// Same as postIngest but copies response body into outBuf (max outLen). Returns true if 2xx.
bool postIngestWithResponse(const char* serverUrl, const char* apiKey, const char* jsonBody,
                            char* outBuf, size_t outLen);

// POST body to /api/vehicle/detect. Returns true if response 2xx.
bool postVehicleDetect(const char* serverUrl, const char* apiKey, const char* jsonBody);

// Same as postVehicleDetect but copies response body into outBuf (max outLen). Returns true if 2xx.
bool postVehicleDetectWithResponse(const char* serverUrl, const char* apiKey, const char* jsonBody,
                                  char* outBuf, size_t outLen);

// GET /api/libs/{vehicleId}, write response into outBuf (max outLen). Returns true if 2xx.
bool getLibJson(const char* serverUrl, const char* apiKey, const char* vehicleId,
                char* outBuf, size_t outLen);

// GET /api/device/commands?device_id=xxx — comandi dalla webapp. Scrive risposta in outBuf. Returns true if 2xx.
bool getDeviceCommands(const char* serverUrl, const char* apiKey, const char* deviceId,
                       char* outBuf, size_t outLen);

// GET /api/protocol-profiles/active?device_id=... — active runtime profile for device.
bool getActiveProtocolProfile(const char* serverUrl, const char* apiKey, const char* deviceId,
                              char* outBuf, size_t outLen);

// CAN sniffer: one frame for postCanSnifferStream
struct CanSnifferFrame {
  uint32_t id;
  uint8_t len;
  uint8_t data[8];
  bool extended;
};

// POST /api/can-sniffer/stream — invia batch di frame CAN (solo se sniffer attivo). sessionId può essere nullptr.
bool postCanSnifferStream(const char* serverUrl, const char* apiKey, const char* deviceId,
                          const char* sessionId, const CanSnifferFrame* frames, size_t numFrames);

// Last HTTP diagnostics for local debugging page/logs.
int apiGetLastHttpCode();
const char* apiGetLastHttpPath();

// Timeout and retry
constexpr unsigned long HTTP_TIMEOUT_MS = 10000;
constexpr int HTTP_MAX_RETRIES = 1;

}  // namespace ev_diag

#endif  // API_CLIENT_H
