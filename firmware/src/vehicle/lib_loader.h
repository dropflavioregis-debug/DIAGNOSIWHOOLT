#ifndef LIB_LOADER_H
#define LIB_LOADER_H

#include <cstddef>

namespace ev_diag {

// Mount SPIFFS/LittleFS if not already. Call at startup. Returns true on success.
bool libLoaderInit();
// True when LittleFS is mounted and ready.
bool libLoaderIsMounted();

// Path prefix in filesystem for libs (e.g. /libs/)
constexpr const char* LIB_PATH_PREFIX = "/libs/";

// Load lib JSON for vehicleId from SPIFFS into outBuf (max outLen). Returns true if file exists and read ok.
bool loadLibFromSpiffs(const char* vehicleId, char* outBuf, size_t outLen);

// Save lib JSON for vehicleId to SPIFFS. Returns true on success.
bool saveLibToSpiffs(const char* vehicleId, const char* json, size_t len);

// Check if lib for vehicleId exists in SPIFFS.
bool hasLibInSpiffs(const char* vehicleId);

}  // namespace ev_diag

#endif  // LIB_LOADER_H
