#ifndef API_CLIENT_H
#define API_CLIENT_H

#include <cstddef>

namespace ev_diag {

// POST body to /api/ingest. Returns true if response 2xx.
bool postIngest(const char* serverUrl, const char* apiKey, const char* jsonBody);

// POST body to /api/vehicle/detect. Returns true if response 2xx.
bool postVehicleDetect(const char* serverUrl, const char* apiKey, const char* jsonBody);

// GET /api/libs/{vehicleId}, write response into outBuf (max outLen). Returns true if 2xx.
bool getLibJson(const char* serverUrl, const char* apiKey, const char* vehicleId,
                char* outBuf, size_t outLen);

// Timeout and retry
constexpr unsigned long HTTP_TIMEOUT_MS = 10000;
constexpr int HTTP_MAX_RETRIES = 1;

}  // namespace ev_diag

#endif  // API_CLIENT_H
