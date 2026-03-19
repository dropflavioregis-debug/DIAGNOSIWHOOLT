#ifndef CONFIG_H
#define CONFIG_H

#include <cstdint>

namespace ev_diag {
namespace config {

// Firmware version for OTA check (bump when releasing)
#define FIRMWARE_VERSION "1.0.0"

// CAN bus — SN65HVD230, TWAI native
constexpr int CAN_TX_GPIO = 17;
constexpr int CAN_RX_GPIO = 18;
constexpr int CAN_SPEED_Kbps_DEFAULT = 500;

// WiFi AP (captive portal)
constexpr const char* AP_SSID_PREFIX = "EV-Diagnostic";
constexpr const char* AP_PASSWORD = "evdiagnostic";
constexpr uint8_t AP_CHANNEL = 1;
constexpr int AP_MAX_CONNECTIONS = 4;

// Vehicle fingerprint
constexpr uint32_t FINGERPRINT_TIMEOUT_MS = 2000;
constexpr size_t MAX_CAN_IDS = 64;

// API paths (relative to server_url)
constexpr const char* API_INGEST = "/api/ingest";
constexpr const char* API_VEHICLE_DETECT = "/api/vehicle/detect";
constexpr const char* API_LIBS_PREFIX = "/api/libs/";
constexpr const char* API_FIRMWARE_LATEST = "/api/firmware/latest";

// OTA: check for update every 24 hours
constexpr unsigned long OTA_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

// NVS keys and max lengths
constexpr const char* NVS_NAMESPACE = "ev_diag";
constexpr size_t MAX_SSID_LEN = 32;
constexpr size_t MAX_PASSWORD_LEN = 64;
constexpr size_t MAX_SERVER_URL_LEN = 128;
constexpr size_t MAX_API_KEY_LEN = 64;
constexpr size_t MAX_DEVICE_NAME_LEN = 32;

}  // namespace config
}  // namespace ev_diag

#endif  // CONFIG_H
