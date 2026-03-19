#include "nvs_config.h"
#include "config/config.h"
#include <nvs.h>
#include <nvs_flash.h>
#include <cstring>

namespace ev_diag {

static const char* KEY_SSID = "wifi_ssid";
static const char* KEY_PASS = "wifi_pass";
static const char* KEY_SERVER = "server_url";
static const char* KEY_APIKEY = "api_key";
static const char* KEY_DEVICE = "device_name";
static const char* KEY_CAN_SPEED = "can_speed";

static bool getString(nvs_handle_t h, const char* key, char* out, size_t maxLen) {
  size_t len = maxLen;
  esp_err_t e = nvs_get_str(h, key, out, &len);
  if (e == ESP_ERR_NVS_NOT_FOUND) {
    out[0] = '\0';
    return true;
  }
  return e == ESP_OK;
}

static bool setString(nvs_handle_t h, const char* key, const char* val) {
  if (val == nullptr) val = "";
  return nvs_set_str(h, key, val) == ESP_OK;
}

bool nvsInit() {
  esp_err_t e = nvs_flash_init();
  if (e == ESP_ERR_NVS_NO_FREE_PAGES || e == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    nvs_flash_erase();
    e = nvs_flash_init();
  }
  return e == ESP_OK;
}

void nvsDeinit() {
  nvs_flash_deinit();
}

bool configLoad(NvsConfig& cfg) {
  std::memset(&cfg, 0, sizeof(cfg));
  cfg.can_speed_kbps = config::CAN_SPEED_Kbps_DEFAULT;

  nvs_handle_t h;
  if (nvs_open(config::NVS_NAMESPACE, NVS_READONLY, &h) != ESP_OK)
    return false;

  getString(h, KEY_SSID, cfg.wifi_ssid, sizeof(cfg.wifi_ssid));
  getString(h, KEY_PASS, cfg.wifi_password, sizeof(cfg.wifi_password));
  getString(h, KEY_SERVER, cfg.server_url, sizeof(cfg.server_url));
  getString(h, KEY_APIKEY, cfg.api_key, sizeof(cfg.api_key));
  getString(h, KEY_DEVICE, cfg.device_name, sizeof(cfg.device_name));

  uint32_t speed = 0;
  if (nvs_get_u32(h, KEY_CAN_SPEED, &speed) == ESP_OK)
    cfg.can_speed_kbps = speed;

  nvs_close(h);
  return true;
}

bool configSave(const NvsConfig& cfg) {
  nvs_handle_t h;
  if (nvs_open(config::NVS_NAMESPACE, NVS_READWRITE, &h) != ESP_OK)
    return false;

  bool ok = setString(h, KEY_SSID, cfg.wifi_ssid)
         && setString(h, KEY_PASS, cfg.wifi_password)
         && setString(h, KEY_SERVER, cfg.server_url)
         && setString(h, KEY_APIKEY, cfg.api_key)
         && setString(h, KEY_DEVICE, cfg.device_name)
         && (nvs_set_u32(h, KEY_CAN_SPEED, cfg.can_speed_kbps) == ESP_OK);

  if (ok)
    nvs_commit(h);
  nvs_close(h);
  return ok;
}

bool configHasWifi(const NvsConfig& cfg) {
  return cfg.wifi_ssid[0] != '\0';
}

bool configClearWifi() {
  nvs_handle_t h;
  if (nvs_open(config::NVS_NAMESPACE, NVS_READWRITE, &h) != ESP_OK)
    return false;
  bool ok = setString(h, KEY_SSID, "") && setString(h, KEY_PASS, "");
  if (ok)
    nvs_commit(h);
  nvs_close(h);
  return ok;
}

}  // namespace ev_diag
