#include "ota_manager.h"
#include "config/config.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <Update.h>
#include <ArduinoJson.h>
#include <cstring>

namespace ev_diag {

struct FirmwareManifest {
  char version[24];
  char url[256];
  char md5[40];
  char minSupportedVersion[24];
  bool compatible;
};

static bool parseFirmwareManifest(const char* json, size_t len, FirmwareManifest* out) {
  if (!json || !out || len == 0) return false;
  out->version[0] = '\0';
  out->url[0] = '\0';
  out->md5[0] = '\0';
  out->minSupportedVersion[0] = '\0';
  out->compatible = true;
  DynamicJsonDocument doc(1536);
  if (deserializeJson(doc, json, len) != DeserializationError::Ok) return false;
  const char* version = doc["version"] | "";
  const char* url = doc["url"] | "";
  const char* md5 = doc["md5"] | "";
  const char* minSupportedVersion = doc["min_supported_version"] | "";
  bool compatible = doc["compatible"].isNull() ? true : (bool)doc["compatible"];
  if (!version || version[0] == '\0' || !url || url[0] == '\0') return false;
  strncpy(out->version, version, sizeof(out->version) - 1);
  out->version[sizeof(out->version) - 1] = '\0';
  strncpy(out->url, url, sizeof(out->url) - 1);
  out->url[sizeof(out->url) - 1] = '\0';
  if (md5 && md5[0] != '\0') {
    strncpy(out->md5, md5, sizeof(out->md5) - 1);
    out->md5[sizeof(out->md5) - 1] = '\0';
  }
  if (minSupportedVersion && minSupportedVersion[0] != '\0') {
    strncpy(out->minSupportedVersion, minSupportedVersion, sizeof(out->minSupportedVersion) - 1);
    out->minSupportedVersion[sizeof(out->minSupportedVersion) - 1] = '\0';
  }
  out->compatible = compatible;
  return true;
}

bool isVersionNewer(const char* current, const char* remote) {
  if (!current || !remote) return false;
  int c = strcmp(remote, current);
  return c > 0;
}

OtaResult otaCheckAndUpdate(const char* serverUrl, const char* apiKey, const char* deviceId, const char* channel) {
  OtaResult r = { false, false, false, nullptr };
  if (!WiFi.isConnected() || !serverUrl || serverUrl[0] == '\0') {
    r.message = "WiFi or server not configured";
    return r;
  }

  String base = serverUrl;
  while (base.endsWith("/")) base.remove(base.length() - 1);
  String manifestUrl = base + config::API_FIRMWARE_LATEST;
  if (deviceId && deviceId[0] != '\0') {
    manifestUrl += "?device_id=";
    manifestUrl += deviceId;
    manifestUrl += "&current_version=";
    manifestUrl += FIRMWARE_VERSION;
    if (channel && channel[0] != '\0') {
      manifestUrl += "&channel=";
      manifestUrl += channel;
    }
  }

  HTTPClient http;
  http.begin(manifestUrl);
  http.setTimeout(15000);
  if (apiKey && apiKey[0] != '\0')
    http.addHeader("X-API-Key", apiKey);

  int code = http.GET();
  if (code != 200) {
    r.checked = true;
    r.error = true;
    r.message = "Manifest fetch failed";
    http.end();
    return r;
  }

  String payload = http.getString();
  http.end();
  r.checked = true;

  FirmwareManifest manifest = {};
  if (!parseFirmwareManifest(payload.c_str(), payload.length(), &manifest)) {
    r.message = "Invalid manifest";
    return r;
  }
  if (!manifest.compatible) {
    r.message = "Update blocked (min_supported_version)";
    return r;
  }

  if (!isVersionNewer(FIRMWARE_VERSION, manifest.version)) {
    r.message = "Already up to date";
    return r;
  }

  HTTPClient httpBin;
  httpBin.begin(manifest.url);
  httpBin.setTimeout(60000);
  int getCode = httpBin.GET();
  if (getCode != 200) {
    r.error = true;
    r.message = "Binary download failed";
    httpBin.end();
    return r;
  }
  int len = httpBin.getSize();
  if (len <= 0 || len > (int)0x140000) {
    r.error = true;
    r.message = "Invalid binary size";
    httpBin.end();
    return r;
  }

  if (!Update.begin((size_t)len, U_FLASH)) {
  if (manifest.md5[0] != '\0') {
    Update.setMD5(manifest.md5);
  }
    r.error = true;
    r.message = "Update begin failed";
    httpBin.end();
    return r;
  }

  WiFiClient* stream = httpBin.getStreamPtr();
  if (!stream) {
    Update.abort();
    r.error = true;
    r.message = "No stream";
    httpBin.end();
    return r;
  }

  const size_t chunkSize = 1024;
  uint8_t buf[chunkSize];
  size_t written = 0;
  while (written < (size_t)len && httpBin.connected()) {
    size_t toRead = (len - written) > (int)chunkSize ? chunkSize : (size_t)(len - written);
    size_t n = stream->readBytes(buf, toRead);
    if (n == 0) break;
    if (Update.write(buf, n) != n) {
      Update.abort();
      r.error = true;
      r.message = "Write failed";
      httpBin.end();
      return r;
    }
    written += n;
  }
  httpBin.end();

  if (written != (size_t)len) {
    Update.abort();
    r.error = true;
    r.message = "Incomplete download";
    return r;
  }

  if (!Update.end(true)) {
    r.error = true;
    r.message = "Update end failed";
    return r;
  }
  r.updated = true;
  r.message = "Update OK, rebooting";
  delay(500);
  ESP.restart();
  return r;
}

}  // namespace ev_diag
