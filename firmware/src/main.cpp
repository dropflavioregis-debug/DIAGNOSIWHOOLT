#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
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
#include "control/command_dispatcher.h"
#include "control/protocol_engine.h"
#include <cstdio>
#include <cstring>
#include <cstdlib>

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
// Keep large buffers out of loopTask stack to prevent stack canary resets.
static char s_ingestBodyBuf[2048];
static char s_ingestRespBuf[256];
static char s_libBuf[2048];
static char s_cmdBuf[384];
static char s_profileBuf[2048];
static ev_diag::CanSnifferFrame s_snifferBatch[SNIFFER_BATCH_MAX];
static char s_detectJsonBuf[512];
static char s_detectRespBuf[1024];
static char s_setupVehicleIdBuf[64];
static char s_setupLibBuf[4096];
static bool s_lastIngestOk = false;
static int s_lastIngestFailCode = 0;
static int s_lastCommandsFailCode = 0;
static int s_lastSnifferFailCode = 0;
static bool s_canFallbackStreamLogged = false;
static uint32_t s_canRxFramesTotal = 0;
static uint32_t s_canRxFramesPerSec = 0;
static uint32_t s_canLastRxMs = 0;
static uint32_t s_canLastId = 0;
static uint8_t s_canLastDlc = 0;
static uint32_t s_canBusOffCount = 0;
static uint32_t s_canRxQueueOverflowCount = 0;
static uint32_t s_canRestartCount = 0;
static unsigned long s_canLastStatsMs = 0;
static uint32_t s_canStatsWindowFrames = 0;
static unsigned long s_lastCanDiagPrintMs = 0;
static char s_lastCanError[96] = "";
static char s_lastProbeSummary[160] = "";
static bool s_prevBusOff = false;

static bool loadConfigFromFilesystemIfNeeded(NvsConfig& cfg) {
  if (configHasWifi(cfg)) return true;
  if (!libLoaderIsMounted() && !libLoaderInit()) return false;

  File f = LittleFS.open("/config.json", "r");
  if (!f)
    f = LittleFS.open("/config.default.json", "r");
  if (!f) return false;
  if (f.size() <= 0 || f.size() > 2048) {
    f.close();
    return false;
  }
  static char fileBuf[2048];
  size_t n = f.readBytes(fileBuf, sizeof(fileBuf) - 1);
  f.close();
  fileBuf[n] = '\0';

  StaticJsonDocument<1024> doc;
  if (deserializeJson(doc, fileBuf) != DeserializationError::Ok) return false;

  NvsConfig fsCfg = {};
  fsCfg.can_speed_kbps = config::CAN_SPEED_Kbps_DEFAULT;
  const char* ssid = doc["wifi_ssid"] | "";
  const char* pass = doc["wifi_password"] | "";
  const char* server = doc["server_url"] | "";
  const char* apiKey = doc["api_key"] | "";
  const char* device = doc["device_name"] | "EV-Diag-01";
  uint32_t canSpeed = doc["can_speed_kbps"] | (uint32_t)config::CAN_SPEED_Kbps_DEFAULT;

  if (!ssid || ssid[0] == '\0') return false;
  strncpy(fsCfg.wifi_ssid, ssid, sizeof(fsCfg.wifi_ssid) - 1);
  strncpy(fsCfg.wifi_password, pass, sizeof(fsCfg.wifi_password) - 1);
  strncpy(fsCfg.server_url, server, sizeof(fsCfg.server_url) - 1);
  strncpy(fsCfg.api_key, apiKey, sizeof(fsCfg.api_key) - 1);
  strncpy(fsCfg.device_name, device, sizeof(fsCfg.device_name) - 1);
  fsCfg.can_speed_kbps = canSpeed;

  if (!configSave(fsCfg)) return false;
  configLoad(cfg);
  return configHasWifi(cfg);
}

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

static bool parseIntJsonField(const char* json, const char* key, int* outValue) {
  if (!json || !key || !outValue) return false;
  const char* p = strstr(json, key);
  if (!p) return false;
  p += strlen(key);
  while (*p == ' ' || *p == '\t') p++;
  char* end = nullptr;
  long v = strtol(p, &end, 10);
  if (end == p) return false;
  *outValue = (int)v;
  return true;
}

static bool isSupportedCanBitrate(int kbps) {
  return kbps == 125 || kbps == 250 || kbps == 500 || kbps == 1000;
}

static void setLastCanError(const char* msg) {
  if (!msg) {
    s_lastCanError[0] = '\0';
    return;
  }
  strncpy(s_lastCanError, msg, sizeof(s_lastCanError) - 1);
  s_lastCanError[sizeof(s_lastCanError) - 1] = '\0';
}

static bool applyCanBitrate(int kbps) {
  if (!isSupportedCanBitrate(kbps)) {
    setLastCanError("Unsupported bitrate");
    return false;
  }
  if (!canReconfigureSpeed(kbps)) {
    setLastCanError("TWAI reconfigure failed");
    return false;
  }
  s_cfg.can_speed_kbps = (uint32_t)kbps;
  (void)configSave(s_cfg);
  s_canRestartCount++;
  setLastCanError("");
  return true;
}

static uint32_t runCanProbeForBitrate(int kbps, unsigned long durationMs, uint32_t* outFirstId) {
  if (outFirstId) *outFirstId = 0;
  if (!applyCanBitrate(kbps)) return 0;
  unsigned long start = millis();
  uint32_t count = 0;
  bool firstSeen = false;
  while (millis() - start < durationMs) {
    uint32_t id = 0;
    uint8_t len = 0;
    uint8_t data[8];
    bool extd = false;
    if (canReceive(&id, &len, data, sizeof(data), &extd)) {
      (void)extd;
      if (!firstSeen) {
        firstSeen = true;
        if (outFirstId) *outFirstId = id;
      }
      count++;
      s_canRxFramesTotal++;
      s_canStatsWindowFrames++;
      s_canLastRxMs = millis();
      s_canLastId = id;
      s_canLastDlc = len;
    } else {
      delay(2);
    }
  }
  return count;
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
    if (loadLibFromSpiffs(s_vehicle_id, s_libBuf, sizeof(s_libBuf))) {
      static StaticJsonDocument<1536> libDoc;
      libDoc.clear();
      if (deserializeJson(libDoc, s_libBuf) == DeserializationError::Ok && libDoc["signals"].is<JsonArray>()) {
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

  if (!buildIngestBody(s_ingestBodyBuf, sizeof(s_ingestBodyBuf))) return false;

  if (!postIngestWithResponse(
          s_cfg.server_url, s_cfg.api_key, s_ingestBodyBuf, s_ingestRespBuf, sizeof(s_ingestRespBuf)))
    return false;

  char parsedId[SESSION_ID_MAX_LEN];
  if (parseSessionIdFromResponse(s_ingestRespBuf, parsedId, sizeof(parsedId)))
    sessionSetId(parsedId);
  bool parsedSniffer = false;
  if (parseSnifferActiveFromResponse(s_ingestRespBuf, &parsedSniffer))
    s_snifferActive = parsedSniffer;
  return true;
}

static void tryRunAssignedProfile() {
  if (s_cfg.server_url[0] == '\0') return;
  char deviceId[40];
  getDeviceId(deviceId, sizeof(deviceId));
  if (!getActiveProtocolProfile(
        s_cfg.server_url, s_cfg.api_key, deviceId, s_profileBuf, sizeof(s_profileBuf))) {
    return;
  }
  ProtocolRunResult run = {};
  if (runProtocolProfileJson(s_profileBuf, &run) && run.ok) {
    wifiLogEvent("Command received: run_profile OK");
    (void)buildAndPostIngest();
  } else {
    wifiLogEvent("Command received: run_profile FAIL");
  }
}

// Esegue i comandi ricevuti dalla webapp (risposta GET /api/device/commands).
static void processDeviceCommands(const char* json) {
  if (!json) return;
  ParsedDeviceCommands parsed = {};
  if (parseDeviceCommandsJson(json, &parsed)) {
    for (size_t i = 0; i < parsed.count; i++) {
      const ParsedDeviceCommand& cmd = parsed.commands[i];
      switch (cmd.type) {
        case DeviceCommandType::StartSession:
          sessionForceNew();
          wifiLogEvent("Command received: start_session");
          break;
        case DeviceCommandType::SetSniffer:
          if (cmd.hasSnifferActive) {
            s_snifferActive = cmd.snifferActive;
            wifiLogEvent(cmd.snifferActive ? "Command received: set_sniffer=true" : "Command received: set_sniffer=false");
          }
          break;
        case DeviceCommandType::ReadVin:
          if (readVin(uds::DID_VIN, s_vin, sizeof(s_vin))) (void)buildAndPostIngest();
          break;
        case DeviceCommandType::ReadDtc: {
          uint8_t dtcBuf[64];
          size_t dtcLen = 0;
          if (readDTC(dtcBuf, sizeof(dtcBuf), &dtcLen)) (void)buildAndPostIngest();
          break;
        }
        case DeviceCommandType::RunProfile:
          tryRunAssignedProfile();
          break;
        case DeviceCommandType::Unknown:
        default:
          break;
      }
    }
  }
  if (strstr(json, "\"start_session\"") != nullptr) {
    sessionForceNew();
    Serial.println("Command: start_session");
    wifiLogEvent("Command received: start_session");
  }
  // sniffer_active dalla dashboard (subscribe CAN Sniffer)
  if (strstr(json, "\"sniffer_active\":true") != nullptr || strstr(json, "\"active\":true") != nullptr) {
    s_snifferActive = true;
    wifiLogEvent("Command received: sniffer_active=true");
  } else if (strstr(json, "\"sniffer_active\"") != nullptr || strstr(json, "\"active\"") != nullptr) {
    s_snifferActive = false;
    wifiLogEvent("Command received: sniffer_active=false");
  }
  if (strstr(json, "\"read_vin\"") != nullptr) {
    if (readVin(uds::DID_VIN, s_vin, sizeof(s_vin))) {
      Serial.print("Command VIN: ");
      Serial.println(s_vin);
      wifiLogEvent("Command received: read_vin OK");
      (void)buildAndPostIngest();
    } else {
      wifiLogEvent("Command received: read_vin FAIL");
    }
  }
  if (strstr(json, "\"read_dtc\"") != nullptr) {
    uint8_t dtcBuf[64];
    size_t dtcLen = 0;
    if (readDTC(dtcBuf, sizeof(dtcBuf), &dtcLen)) {
      char line[72];
      snprintf(line, sizeof(line), "Command received: read_dtc OK len=%u", (unsigned)dtcLen);
      wifiLogEvent(line);
      (void)buildAndPostIngest();
    } else {
      wifiLogEvent("Command received: read_dtc FAIL");
    }
  }
  if (strstr(json, "\"set_can_bitrate\"") != nullptr) {
    int bitrate = 0;
    if (parseIntJsonField(json, "\"bitrate_kbps\":", &bitrate) && isSupportedCanBitrate(bitrate)) {
      if (applyCanBitrate(bitrate)) {
        char line[96];
        snprintf(line, sizeof(line), "Command set_can_bitrate OK: %d", bitrate);
        wifiLogEvent(line);
      } else {
        char line[96];
        snprintf(line, sizeof(line), "Command set_can_bitrate FAIL: %d", bitrate);
        wifiLogEvent(line);
      }
    } else {
      wifiLogEvent("Command set_can_bitrate invalid payload");
    }
  }
  if (strstr(json, "\"can_debug_probe\"") != nullptr) {
    int durationMs = 2000;
    (void)parseIntJsonField(json, "\"duration_ms\":", &durationMs);
    if (durationMs < 500) durationMs = 500;
    if (durationMs > 10000) durationMs = 10000;
    int bitrate = canGetSpeedKbps();
    (void)parseIntJsonField(json, "\"bitrate_kbps\":", &bitrate);
    if (!isSupportedCanBitrate(bitrate)) bitrate = canGetSpeedKbps();
    uint32_t firstId = 0;
    uint32_t frames = runCanProbeForBitrate(bitrate, (unsigned long)durationMs, &firstId);
    snprintf(
      s_lastProbeSummary,
      sizeof(s_lastProbeSummary),
      "probe bitrate=%d duration_ms=%d frames=%lu first_id=%lu",
      bitrate,
      durationMs,
      (unsigned long)frames,
      (unsigned long)firstId
    );
    wifiLogEvent(s_lastProbeSummary);
  }
  if (strstr(json, "\"can_bitrate_sweep\"") != nullptr) {
    int durationMs = 1200;
    (void)parseIntJsonField(json, "\"duration_ms\":", &durationMs);
    if (durationMs < 400) durationMs = 400;
    if (durationMs > 5000) durationMs = 5000;
    const int sweep[] = { 125, 250, 500, 1000 };
    char summary[160];
    int n = snprintf(summary, sizeof(summary), "sweep %dms:", durationMs);
    for (size_t i = 0; i < 4 && n > 0 && (size_t)n < sizeof(summary); i++) {
      uint32_t firstId = 0;
      uint32_t frames = runCanProbeForBitrate(sweep[i], (unsigned long)durationMs, &firstId);
      int w = snprintf(
        summary + n,
        sizeof(summary) - (size_t)n,
        " %d=%lu",
        sweep[i],
        (unsigned long)frames
      );
      if (w < 0) break;
      n += w;
    }
    strncpy(s_lastProbeSummary, summary, sizeof(s_lastProbeSummary) - 1);
    s_lastProbeSummary[sizeof(s_lastProbeSummary) - 1] = '\0';
    wifiLogEvent(s_lastProbeSummary);
  }
  // Estensibile: altri comandi es. "reboot", "sync_config" ecc.
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("EV-Diagnostic firmware");
  wifiLogEvent("Boot firmware");

  if (!nvsInit()) {
    Serial.println("NVS init failed");
    wifiLogEvent("NVS init failed");
    return;
  }
  configLoad(s_cfg);

  if (!libLoaderInit()) {
    Serial.println("FS init failed");
    wifiLogEvent("LittleFS init failed");
  }

  if (loadConfigFromFilesystemIfNeeded(s_cfg)) {
    Serial.println("Config loaded from NVS/FS");
  } else if (!configHasWifi(s_cfg)) {
    Serial.println("No config in NVS/FS");
    Serial.println("Missing /config.json in LittleFS (run: pio run -t uploadfs)");
  }

  int txGpio = config::CAN_TX_GPIO;
  int rxGpio = config::CAN_RX_GPIO;
  int speedKbps = (s_cfg.can_speed_kbps > 0) ? (int)s_cfg.can_speed_kbps : config::CAN_SPEED_Kbps_DEFAULT;
  if (canInit(txGpio, rxGpio, speedKbps)) {
    Serial.println("CAN OK");
    wifiLogEvent("CAN init OK");
  }
  udsClientInit(uds::OBD_REQUEST_ID, uds::OBD_RESPONSE_ID);

  if (!configHasWifi(s_cfg)) {
    Serial.println("No WiFi config -> AP + captive portal");
    wifiLogEvent("No WiFi config, starting AP portal");
    wifiStartAPAndCaptivePortal();
    return;
  }

  if (!wifiConnectSTA(s_cfg)) {
    Serial.println("STA connect failed, starting AP");
    wifiLogEvent("STA connect failed, fallback AP");
    wifiStartAPAndCaptivePortal();
    return;
  }
  Serial.println("WiFi connected");
  wifiLogEvent("WiFi connected");
  Serial.print("Reconfigure: http://");
  Serial.println(WiFi.localIP());
  wifiStartReconfigureServer();

  if (canIsStarted() && s_cfg.server_url[0] != '\0') {
    CanIdList ids;
    size_t n = collectCanIds(config::FINGERPRINT_TIMEOUT_MS, ids);
    if (n > 0) {
      if (canIdsToJson(ids, s_detectJsonBuf, sizeof(s_detectJsonBuf))) {
        if (postVehicleDetectWithResponse(
                s_cfg.server_url, s_cfg.api_key, s_detectJsonBuf, s_detectRespBuf, sizeof(s_detectRespBuf))) {
          Serial.println("Vehicle detect OK");
          wifiLogEvent("Vehicle detect OK");
          if (parseVehicleIdFromResponse(s_detectRespBuf, s_setupVehicleIdBuf, sizeof(s_setupVehicleIdBuf))) {
            strncpy(s_vehicle_id, s_setupVehicleIdBuf, sizeof(s_vehicle_id) - 1);
            s_vehicle_id[sizeof(s_vehicle_id) - 1] = '\0';
            if (getLibJson(
                    s_cfg.server_url, s_cfg.api_key, s_setupVehicleIdBuf, s_setupLibBuf, sizeof(s_setupLibBuf))) {
              if (saveLibToSpiffs(s_setupVehicleIdBuf, s_setupLibBuf, strlen(s_setupLibBuf))) {
                Serial.println("Lib saved to SPIFFS");
                wifiLogEvent("Vehicle lib saved to SPIFFS");
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
      wifiLogEvent("VIN read OK");
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
      if (wifiConnectSTA(s_cfg)) {
        wifiLogEvent("WiFi reconnected");
      }
    }
    delay(100);
    return;
  }

  wifiReconfigureLoop();

  if (s_cfg.server_url[0] != '\0' && (millis() - s_lastIngestMs >= INGEST_INTERVAL_MS)) {
    s_lastIngestMs = millis();
    if (buildAndPostIngest()) {
      Serial.println("Ingest OK");
      s_lastIngestOk = true;
      s_lastIngestFailCode = 0;
    } else {
      s_lastIngestOk = false;
      const int code = apiGetLastHttpCode();
      if (code != s_lastIngestFailCode) {
        s_lastIngestFailCode = code;
        char logLine[120];
        snprintf(
          logLine,
          sizeof(logLine),
          "Ingest FAIL %s code=%d",
          apiGetLastHttpPath(),
          code
        );
        wifiLogEvent(logLine);
      }
    }
  }

  if (s_cfg.server_url[0] != '\0' && (millis() - s_lastOtaCheckMs >= config::OTA_CHECK_INTERVAL_MS)) {
    s_lastOtaCheckMs = millis();
    char deviceId[40];
    getDeviceId(deviceId, sizeof(deviceId));
    OtaResult ota = otaCheckAndUpdate(s_cfg.server_url, s_cfg.api_key, deviceId, "stable");
    if (ota.checked && ota.message) {
      Serial.println(ota.message);
    }
  }

  // Poll comandi dalla webapp (avvia sessione, sniffer_active, ecc.)
  if (s_cfg.server_url[0] != '\0' && (millis() - s_lastCommandsPollMs >= COMMANDS_POLL_INTERVAL_MS)) {
    s_lastCommandsPollMs = millis();
    char deviceId[40];
    getDeviceId(deviceId, sizeof(deviceId));
    if (getDeviceCommands(s_cfg.server_url, s_cfg.api_key, deviceId, s_cmdBuf, sizeof(s_cmdBuf))) {
      s_lastCommandsFailCode = 0;
      processDeviceCommands(s_cmdBuf);
    } else {
      const int code = apiGetLastHttpCode();
      if (code != s_lastCommandsFailCode) {
        s_lastCommandsFailCode = code;
        char logLine[120];
        snprintf(
          logLine,
          sizeof(logLine),
          "Commands poll FAIL %s code=%d",
          apiGetLastHttpPath(),
          code
        );
        wifiLogEvent(logLine);
      }
    }
  }

  // CAN Sniffer: keep CAN stream alive even without vehicle detect.
  // If vehicle_id is still unknown, force streaming so dashboard can show live CAN activity.
  const bool canFallbackStreaming = (!s_snifferActive && s_vehicle_id[0] == '\0');
  const bool shouldStreamCan = s_snifferActive || (s_vehicle_id[0] == '\0');
  if (canFallbackStreaming && !s_canFallbackStreamLogged) {
    Serial.println("CAN stream fallback active");
    wifiLogEvent("CAN stream fallback active");
    s_canFallbackStreamLogged = true;
  } else if (!canFallbackStreaming && s_canFallbackStreamLogged) {
    s_canFallbackStreamLogged = false;
  }
  if (shouldStreamCan && canIsStarted() && s_cfg.server_url[0] != '\0' &&
      (millis() - s_lastSnifferSendMs >= SNIFFER_BATCH_INTERVAL_MS)) {
    s_lastSnifferSendMs = millis();
    size_t n = 0;
    while (n < SNIFFER_BATCH_MAX) {
      uint32_t id;
      uint8_t len;
      uint8_t data[8];
      bool extd = false;
      if (!canReceive(&id, &len, data, sizeof(data), &extd))
        break;
      s_canRxFramesTotal++;
      s_canStatsWindowFrames++;
      s_canLastRxMs = millis();
      s_canLastId = id;
      s_canLastDlc = len;
      s_snifferBatch[n].id = id;
      s_snifferBatch[n].len = len;
      s_snifferBatch[n].extended = extd;
      for (uint8_t i = 0; i < 8; i++) s_snifferBatch[n].data[i] = data[i];
      n++;
    }
    if (n > 0) {
      char deviceId[40];
      getDeviceId(deviceId, sizeof(deviceId));
      const char* sid = sessionGetId();
      if (postCanSnifferStream(
              s_cfg.server_url, s_cfg.api_key, deviceId,
              (sid && sid[0] != '\0') ? sid : nullptr, s_snifferBatch, n)) {
        s_lastSnifferFailCode = 0;
        // ok
      } else {
        const int code = apiGetLastHttpCode();
        if (code != s_lastSnifferFailCode) {
          s_lastSnifferFailCode = code;
          char logLine[120];
          snprintf(
            logLine,
            sizeof(logLine),
            "Sniffer stream FAIL %s code=%d",
            apiGetLastHttpPath(),
            code
          );
          wifiLogEvent(logLine);
        }
      }
    }
  }

  if (canIsStarted()) {
    CanStatus canStatus = {};
    if (canGetStatus(&canStatus)) {
      if (canStatus.busOff && !s_prevBusOff) s_canBusOffCount++;
      s_prevBusOff = canStatus.busOff;
      s_canRxQueueOverflowCount = canStatus.rxOverrunCount + canStatus.rxMissCount;
      if (canStatus.busOff) setLastCanError("TWAI BUS-OFF");
      else if (canStatus.recovering) setLastCanError("TWAI recovering");
      else if (s_lastCanError[0] != '\0' &&
               strcmp(s_lastCanError, "TWAI BUS-OFF") == 0) setLastCanError("");
    }
  }

  if (millis() - s_canLastStatsMs >= 1000) {
    s_canLastStatsMs = millis();
    s_canRxFramesPerSec = s_canStatsWindowFrames;
    s_canStatsWindowFrames = 0;
  }

  if (millis() - s_lastCanDiagPrintMs >= 1000) {
    s_lastCanDiagPrintMs = millis();
    Serial.printf(
      "CAN diag: bitrate=%d rx_total=%lu rx_s=%lu last_id=0x%lX dlc=%u last_rx_ms=%lu err=%s\n",
      canGetSpeedKbps(),
      (unsigned long)s_canRxFramesTotal,
      (unsigned long)s_canRxFramesPerSec,
      (unsigned long)s_canLastId,
      (unsigned)s_canLastDlc,
      (unsigned long)((s_canLastRxMs > 0) ? (millis() - s_canLastRxMs) : 0UL),
      (s_lastCanError[0] != '\0') ? s_lastCanError : "-"
    );
  }

  wifiSetRuntimeStatus(
    canIsStarted(),
    s_snifferActive,
    sessionGetId(),
    s_vehicle_id[0] != '\0' ? s_vehicle_id : nullptr,
    s_lastIngestOk,
    millis() - s_lastIngestMs,
    s_canRxFramesTotal,
    s_canRxFramesPerSec,
    (s_canLastRxMs > 0) ? (millis() - s_canLastRxMs) : 0UL,
    s_canLastId,
    s_canLastDlc,
    s_canBusOffCount,
    s_canRxQueueOverflowCount,
    s_canRestartCount,
    canGetSpeedKbps(),
    s_lastCanError,
    s_lastProbeSummary
  );

  delay(50);
}
