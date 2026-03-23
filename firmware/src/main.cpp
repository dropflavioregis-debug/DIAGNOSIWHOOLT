#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include "config/config.h"
#include "config/nvs_config.h"
#include "can/can_driver.h"
#include "wifi/wifi_manager.h"
#include "api/api_client.h"
#include "session_state.h"
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
static unsigned long s_lastCommandsPollMs = 0;
static const unsigned long INGEST_INTERVAL_MS = 1000;
static const unsigned long WIFI_RETRY_INTERVAL_MS = 5000;
static const unsigned long COMMANDS_POLL_INTERVAL_MS = 5000;   // Poll comandi webapp ogni 5 s
static const unsigned long SNIFFER_BATCH_INTERVAL_MS = 200;    // Invia batch CAN ogni 200 ms
static const size_t SNIFFER_BATCH_MAX = 32;                      // Max frame per batch
static const size_t MAX_READINGS_PER_CYCLE = 15;                 // Limit DIDs per ingest to avoid timeout

static char s_vin[18] = { 0 };  // 17 chars + NUL, filled by readVin in setup
static char s_vehicle_id[64] = { 0 };  // Set from vehicle/detect response
static bool s_snifferActive = false;
static unsigned long s_lastSnifferSendMs = 0;

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

// Parse "session_id":"uuid" from JSON response. Writes uuid into out (max outLen). Returns true if found.
static bool parseSessionIdFromResponse(const char* json, char* out, size_t outLen) {
  const char* key = "\"session_id\":\"";
  const char* p = strstr(json, key);
  if (!p) return false;
  p += strlen(key);
  const char* end = strchr(p, '"');
  if (!end || (size_t)(end - p) >= outLen) return false;
  size_t len = (size_t)(end - p);
  memcpy(out, p, len);
  out[len] = '\0';
  return true;
}

// Parse "vehicle_id":"uuid" from vehicle/detect JSON response. Writes uuid into out (max outLen). Returns true if found.
static bool parseVehicleIdFromResponse(const char* json, char* out, size_t outLen) {
  const char* key = "\"vehicle_id\":\"";
  const char* p = strstr(json, key);
  if (!p) return false;
  p += strlen(key);
  const char* end = strchr(p, '"');
  if (!end || (size_t)(end - p) >= outLen) return false;
  size_t len = (size_t)(end - p);
  memcpy(out, p, len);
  out[len] = '\0';
  return true;
}

// Parse "sniffer_active":true|false from JSON response.
// Returns true if key is present and writes value into outActive.
static bool parseSnifferActiveFromResponse(const char* json, bool* outActive) {
  if (!json || !outActive) return false;
  const char* key = "\"sniffer_active\":";
  const char* p = strstr(json, key);
  if (!p) return false;
  p += strlen(key);
  while (*p == ' ' || *p == '\t') p++;
  if (strncmp(p, "true", 4) == 0) {
    *outActive = true;
    return true;
  }
  if (strncmp(p, "false", 5) == 0) {
    *outActive = false;
    return true;
  }
  return false;
}

// Parse DID string (e.g. "0xF190", "F190", "0x5B3F") to uint16_t. Returns true if valid.
static bool parseDidString(const char* str, uint16_t* outDid) {
  if (!str || !outDid) return false;
  unsigned int v = 0;
  if (strncmp(str, "0x", 2) == 0 || strncmp(str, "0X", 2) == 0)
    str += 2;
  if (*str == '\0') return false;
  for (; *str; str++) {
    char c = *str;
    if (c >= '0' && c <= '9') v = (v << 4) | (c - '0');
    else if (c >= 'A' && c <= 'F') v = (v << 4) | (c - 'A' + 10);
    else if (c >= 'a' && c <= 'f') v = (v << 4) | (c - 'a' + 10);
    else return false;
  }
  *outDid = (uint16_t)(v & 0xFFFF);
  return true;
}

// Decode UDS 0x59 DTC response: after 0x59, 0x02 comes mask, formatId, then 4 bytes per DTC (3 bytes code + 1 status).
// DTC string: P/C/B/U + 5 hex digits (ISO 15031-6).
static void decodeDtcResponse(const uint8_t* data, size_t len, char dtcStrings[][8], size_t maxDtc, size_t* outCount) {
  *outCount = 0;
  if (!data || len < 4 || !dtcStrings || maxDtc == 0) return;
  size_t numDtc = (len - 2) / 4;
  if (numDtc > maxDtc) numDtc = maxDtc;
  const char typeChar[] = { 'P', 'C', 'B', 'U' };
  for (size_t i = 0; i < numDtc; i++) {
    const uint8_t* d = data + 2 + i * 4;
    uint8_t t = (d[0] >> 4) & 0x03;
    int n = snprintf(dtcStrings[*outCount], 8, "%c%01X%01X%01X%01X%01X",
                    typeChar[t], (d[0] >> 0) & 0x0F, (d[1] >> 4) & 0x0F, d[1] & 0x0F, (d[2] >> 4) & 0x0F, d[2] & 0x0F);
    if (n > 0 && n < 8) (*outCount)++;
  }
}

// Collect readings from vehicle lib (DIDs) and DTCs via UDS, build ingest body with ArduinoJson.
// Returns true if body was written to bodyBuf (bodyLen bytes). If no lib or no signals, builds minimal body.
static bool buildIngestBody(char* bodyBuf, size_t bodyLen) {
  if (!bodyBuf || bodyLen < 256) return false;

  char deviceId[40];
  getDeviceId(deviceId, sizeof(deviceId));
  const char* sid = sessionGetId();
  bool startNew = sessionShouldStartNew();
  if (startNew) sessionClearForceNew();

  DynamicJsonDocument doc(2048);
  doc["device_id"] = deviceId;
  if (sid && sid[0] != '\0') doc["session_id"] = sid;
  if (s_vin[0] != '\0') doc["vin"] = s_vin;
  if (s_vehicle_id[0] != '\0') doc["vehicle_id"] = s_vehicle_id;

  JsonArray readings = doc.createNestedArray("readings");
  JsonArray rawDtc = doc.createNestedArray("raw_dtc");

  if (s_vehicle_id[0] != '\0' && canIsStarted()) {
    char libBuf[2048];
    if (loadLibFromSpiffs(s_vehicle_id, libBuf, sizeof(libBuf))) {
      StaticJsonDocument<1536> libDoc;
      if (deserializeJson(libDoc, libBuf) == DeserializationError::Ok && libDoc["signals"].is<JsonArray>()) {
        JsonArray sigs = libDoc["signals"].as<JsonArray>();
        size_t count = 0;
        for (JsonVariant v : sigs) {
          if (count >= MAX_READINGS_PER_CYCLE) break;
          JsonObject s = v.as<JsonObject>();
          if (s.isNull()) continue;
          const char* didStr = s["did"].as<const char*>();
          const char* name = s["name"].as<const char*>();
          if (!didStr || !name) continue;
          uint16_t did = 0;
          if (!parseDidString(didStr, &did)) continue;
          uint8_t raw[8];
          size_t rawLen = 0;
          if (!readDataByIdentifier(did, raw, sizeof(raw), &rawLen) || rawLen == 0) continue;
          JsonObject r = readings.createNestedObject();
          r["name"] = name;
          double val = (rawLen >= 1) ? (double)raw[0] : 0.0;
          const char* formula = s["formula"].as<const char*>();
          if (formula && rawLen >= 2 && (strcmp(formula, "A*256+B") == 0 || strstr(formula, "256")))
            val = (double)((raw[0] << 8) | raw[1]) * 0.1;
          else if (rawLen >= 1)
            val = (double)raw[0];
          r["value"] = val;
          char rawHex[24];
          size_t hexLen = 0;
          for (size_t i = 0; i < rawLen && hexLen < sizeof(rawHex) - 2; i++)
            hexLen += (size_t)snprintf(rawHex + hexLen, sizeof(rawHex) - hexLen, "%02X", raw[i]);
          r["raw_value"] = rawHex;
          count++;
        }
      }
    }
    uint8_t dtcBuf[64];
    size_t dtcLen = 0;
    if (readDTC(dtcBuf, sizeof(dtcBuf), &dtcLen) && dtcLen >= 4) {
      char dtcStrings[8][8];
      size_t numDtc = 0;
      decodeDtcResponse(dtcBuf, dtcLen, dtcStrings, 8, &numDtc);
      for (size_t i = 0; i < numDtc; i++)
        rawDtc.add(dtcStrings[i]);
    }
  }

  size_t written = serializeJson(doc, bodyBuf, bodyLen);
  return written > 0 && written < bodyLen;
}

static bool buildAndPostIngest() {
  if (s_cfg.server_url[0] == '\0') return false;

  static char body[2048];
  if (!buildIngestBody(body, sizeof(body))) return false;

  char respBuf[256];
  if (!postIngestWithResponse(s_cfg.server_url, s_cfg.api_key, body, respBuf, sizeof(respBuf)))
    return false;

  char parsedId[SESSION_ID_MAX_LEN];
  if (parseSessionIdFromResponse(respBuf, parsedId, sizeof(parsedId)))
    sessionSetId(parsedId);
  bool parsedSniffer = false;
  if (parseSnifferActiveFromResponse(respBuf, &parsedSniffer))
    s_snifferActive = parsedSniffer;
  return true;
}

// Esegue i comandi ricevuti dalla webapp (risposta GET /api/device/commands).
static void processDeviceCommands(const char* json) {
  if (!json) return;
  if (strstr(json, "\"start_session\"") != nullptr) {
    sessionForceNew();
    Serial.println("Command: start_session");
  }
  // sniffer_active dalla dashboard (subscribe CAN Sniffer)
  if (strstr(json, "\"sniffer_active\":true") != nullptr) {
    s_snifferActive = true;
  } else if (strstr(json, "\"sniffer_active\"") != nullptr) {
    s_snifferActive = false;
  }
  // Estensibile: altri comandi es. "reboot", "sync_config" ecc.
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
      if (canIdsToJson(ids, jsonBuf, sizeof(jsonBuf))) {
        char detectRespBuf[1024];
        if (postVehicleDetectWithResponse(s_cfg.server_url, s_cfg.api_key, jsonBuf, detectRespBuf, sizeof(detectRespBuf))) {
          Serial.println("Vehicle detect OK");
          char vehicleId[64];
          if (parseVehicleIdFromResponse(detectRespBuf, vehicleId, sizeof(vehicleId))) {
            strncpy(s_vehicle_id, vehicleId, sizeof(s_vehicle_id) - 1);
            s_vehicle_id[sizeof(s_vehicle_id) - 1] = '\0';
            char libBuf[4096];
            if (getLibJson(s_cfg.server_url, s_cfg.api_key, vehicleId, libBuf, sizeof(libBuf))) {
              if (saveLibToSpiffs(vehicleId, libBuf, strlen(libBuf))) {
                Serial.println("Lib saved to SPIFFS");
              }
            }
          }
        }
      }
    }
    // Read VIN via UDS (default DID 0xF190; vehicle-specific DID can be added from lib later)
    if (readVin(uds::DID_VIN, s_vin, sizeof(s_vin))) {
      Serial.print("VIN: ");
      Serial.println(s_vin);
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

  // Poll comandi dalla webapp (avvia sessione, sniffer_active, ecc.)
  if (s_cfg.server_url[0] != '\0' && (millis() - s_lastCommandsPollMs >= COMMANDS_POLL_INTERVAL_MS)) {
    s_lastCommandsPollMs = millis();
    char deviceId[40];
    getDeviceId(deviceId, sizeof(deviceId));
    char cmdBuf[384];
    if (getDeviceCommands(s_cfg.server_url, s_cfg.api_key, deviceId, cmdBuf, sizeof(cmdBuf))) {
      processDeviceCommands(cmdBuf);
    }
  }

  // CAN Sniffer: legge frame e invia batch al backend quando sniffer attivo
  if (s_snifferActive && canIsStarted() && s_cfg.server_url[0] != '\0' &&
      (millis() - s_lastSnifferSendMs >= SNIFFER_BATCH_INTERVAL_MS)) {
    s_lastSnifferSendMs = millis();
    ev_diag::CanSnifferFrame batch[SNIFFER_BATCH_MAX];
    size_t n = 0;
    while (n < SNIFFER_BATCH_MAX) {
      uint32_t id;
      uint8_t len;
      uint8_t data[8];
      bool extd = false;
      if (!canReceive(&id, &len, data, sizeof(data), &extd))
        break;
      batch[n].id = id;
      batch[n].len = len;
      batch[n].extended = extd;
      for (uint8_t i = 0; i < 8; i++) batch[n].data[i] = data[i];
      n++;
    }
    if (n > 0) {
      char deviceId[40];
      getDeviceId(deviceId, sizeof(deviceId));
      const char* sid = sessionGetId();
      if (postCanSnifferStream(
              s_cfg.server_url, s_cfg.api_key, deviceId,
              (sid && sid[0] != '\0') ? sid : nullptr, batch, n)) {
        // ok
      }
    }
  }

  delay(50);
}
