#include <Arduino.h>
#include <WiFi.h>
#include "config/config.h"
#include "config/nvs_config.h"
#include "can/can_driver.h"
#include "wifi/wifi_manager.h"
#include "api/api_client.h"
#include "vehicle/fingerprint.h"
#include "vehicle/lib_loader.h"
#include "uds/uds_client.h"
#include "uds/uds_services.h"
#include "ota/ota_manager.h"
#include <cstdio>
#include <cstring>

using namespace ev_diag;

static NvsConfig s_cfg;
static unsigned long s_lastIngestMs = 0;
static unsigned long s_lastWifiRetryMs = 0;
static unsigned long s_lastOtaCheckMs = 0;
static const unsigned long INGEST_INTERVAL_MS = 1000;
static const unsigned long WIFI_RETRY_INTERVAL_MS = 5000;

static void getDeviceId(char* out, size_t len) {
  if (s_cfg.device_name[0] != '\0') {
    strncpy(out, s_cfg.device_name, len - 1);
    out[len - 1] = '\0';
    return;
  }
  uint8_t mac[6];
  WiFi.macAddress(mac);
  snprintf(out, len, "EV-%02X%02X%02X", mac[3], mac[4], mac[5]);
}

static bool buildAndPostIngest() {
  if (s_cfg.server_url[0] == '\0') return false;

  char deviceId[40];
  getDeviceId(deviceId, sizeof(deviceId));

  // Minimal payload: device_id, readings (empty if no lib), raw_dtc (empty)
  char body[320];
  int n = snprintf(body, sizeof(body),
    "{\"device_id\":\"%s\",\"readings\":[],\"raw_dtc\":[]}", deviceId);

  if (n < 0 || (size_t)n >= sizeof(body)) return false;
  return postIngest(s_cfg.server_url, s_cfg.api_key, body);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("EV-Diagnostic firmware");

  if (!nvsInit()) {
    Serial.println("NVS init failed");
    return;
  }
  configLoad(s_cfg);

  if (!libLoaderInit()) {
    Serial.println("FS init failed");
  }

  int txGpio = config::CAN_TX_GPIO;
  int rxGpio = config::CAN_RX_GPIO;
  int speedKbps = (s_cfg.can_speed_kbps > 0) ? (int)s_cfg.can_speed_kbps : config::CAN_SPEED_Kbps_DEFAULT;
  if (canInit(txGpio, rxGpio, speedKbps)) {
    Serial.println("CAN OK");
  }
  udsClientInit(uds::OBD_REQUEST_ID, uds::OBD_RESPONSE_ID);

  if (!configHasWifi(s_cfg)) {
    Serial.println("No WiFi config -> AP + captive portal");
    wifiStartAPAndCaptivePortal();
    return;
  }

  if (!wifiConnectSTA(s_cfg)) {
    Serial.println("STA connect failed, starting AP");
    wifiStartAPAndCaptivePortal();
    return;
  }
  Serial.println("WiFi connected");
  Serial.print("Reconfigure: http://");
  Serial.println(WiFi.localIP());
  wifiStartReconfigureServer();

  if (canIsStarted() && s_cfg.server_url[0] != '\0') {
    CanIdList ids;
    size_t n = collectCanIds(config::FINGERPRINT_TIMEOUT_MS, ids);
    if (n > 0) {
      char jsonBuf[512];
      if (canIdsToJson(ids, jsonBuf, sizeof(jsonBuf)) && postVehicleDetect(s_cfg.server_url, s_cfg.api_key, jsonBuf)) {
        Serial.println("Vehicle detect sent");
        char respBuf[1024];
        if (getLibJson(s_cfg.server_url, s_cfg.api_key, "00000000-0000-0000-0000-000000000001", respBuf, sizeof(respBuf))) {
          if (saveLibToSpiffs("00000000-0000-0000-0000-000000000001", respBuf, strlen(respBuf))) {
            Serial.println("Lib saved to SPIFFS");
          }
        }
      }
    }
  }

  s_lastIngestMs = millis();
}

void loop() {
  if (wifiManagerLoop()) {
    delay(10);
    return;
  }

  if (!wifiIsConnected()) {
    if (millis() - s_lastWifiRetryMs >= WIFI_RETRY_INTERVAL_MS) {
      s_lastWifiRetryMs = millis();
      wifiConnectSTA(s_cfg);
    }
    delay(100);
    return;
  }

  wifiReconfigureLoop();

  if (s_cfg.server_url[0] != '\0' && (millis() - s_lastIngestMs >= INGEST_INTERVAL_MS)) {
    s_lastIngestMs = millis();
    if (buildAndPostIngest()) {
      Serial.println("Ingest OK");
    }
  }

  if (s_cfg.server_url[0] != '\0' && (millis() - s_lastOtaCheckMs >= config::OTA_CHECK_INTERVAL_MS)) {
    s_lastOtaCheckMs = millis();
    OtaResult ota = otaCheckAndUpdate(s_cfg.server_url, s_cfg.api_key);
    if (ota.checked && ota.message) {
      Serial.println(ota.message);
    }
  }

  delay(50);
}
