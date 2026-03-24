#ifndef OTA_MANAGER_H
#define OTA_MANAGER_H

#include <cstddef>

namespace ev_diag {

struct OtaResult {
  bool checked;   // true if we performed a check
  bool updated;   // true if update was applied (device will reboot)
  bool error;     // true if check or update failed
  const char* message;
};

// Check server for firmware update. If newer version and url present, download and flash.
// Returns after update (device may reboot). serverUrl = base URL, apiKey optional.
OtaResult otaCheckAndUpdate(const char* serverUrl, const char* apiKey, const char* deviceId, const char* channel);

// Simple version compare: returns true if remote > current (lexicographic, e.g. "1.0.1" > "1.0.0")
bool isVersionNewer(const char* current, const char* remote);

}  // namespace ev_diag

#endif  // OTA_MANAGER_H
