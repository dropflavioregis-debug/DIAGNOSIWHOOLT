#ifndef NVS_CONFIG_H
#define NVS_CONFIG_H

#include <cstddef>
#include <cstdint>

namespace ev_diag {

struct NvsConfig {
  char wifi_ssid[33];
  char wifi_password[65];
  char server_url[129];
  char api_key[65];
  char device_name[33];
  uint32_t can_speed_kbps;
};

// Load config from NVS into cfg. Returns true if all required fields present.
bool configLoad(NvsConfig& cfg);

// Save config to NVS. Returns true on success.
bool configSave(const NvsConfig& cfg);

// True if wifi_ssid is non-empty (WiFi was configured).
bool configHasWifi(const NvsConfig& cfg);

// Clear WiFi credentials in NVS. After restart the device will enter AP + captive portal.
bool configClearWifi();

// Initialize NVS (call once at startup). Returns true on success.
bool nvsInit();

void nvsDeinit();

}  // namespace ev_diag

#endif  // NVS_CONFIG_H
