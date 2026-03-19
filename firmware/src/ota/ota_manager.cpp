#include "ota_manager.h"
#include "config/config.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <Update.h>
#include <cstring>

namespace ev_diag {

// Minimal JSON parse: find "version":"...", "url":"..."
static bool parseFirmwareManifest(const char* json, size_t len, char* outVersion, size_t versionLen, char* outUrl, size_t urlLen) {
  const char* vkey = "\"version\":\"";
  const char* v = strstr(json, vkey);
  if (!v) return false;
  v += strlen(vkey);
  const char* ve = strchr(v, '"');
  if (!ve || (size_t)(ve - v) >= versionLen) return false;
  memcpy(outVersion, v, ve - v);
  outVersion[ve - v] = '\0';

  const char* ukey = "\"url\":\"";
  const char* u = strstr(json, ukey);
  if (!u) return false;
  u += strlen(ukey);
  const char* ue = strchr(u, '"');
  if (!ue || (size_t)(ue - u) >= urlLen) return false;
  memcpy(outUrl, u, ue - u);
  outUrl[ue - u] = '\0';
  return outUrl[0] != '\0';
}

bool isVersionNewer(const char* current, const char* remote) {
  if (!current || !remote) return false;
  int c = strcmp(remote, current);
  return c > 0;
}

OtaResult otaCheckAndUpdate(const char* serverUrl, const char* apiKey) {
  OtaResult r = { false, false, false, nullptr };
  if (!WiFi.isConnected() || !serverUrl || serverUrl[0] == '\0') {
    r.message = "WiFi or server not configured";
    return r;
  }

  String base = serverUrl;
  while (base.endsWith("/")) base.remove(base.length() - 1);
  String manifestUrl = base + config::API_FIRMWARE_LATEST;

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

  char remoteVersion[24];
  char binUrl[256];
  if (!parseFirmwareManifest(payload.c_str(), payload.length(), remoteVersion, sizeof(remoteVersion), binUrl, sizeof(binUrl))) {
    r.message = "Invalid manifest";
    return r;
  }

  if (!isVersionNewer(FIRMWARE_VERSION, remoteVersion)) {
    r.message = "Already up to date";
    return r;
  }

  HTTPClient httpBin;
  httpBin.begin(binUrl);
  httpBin.setTimeout(60000);
  int len = httpBin.getSize();
  if (len <= 0 || len > (int)0x140000) {
    r.error = true;
    r.message = "Invalid binary size";
    httpBin.end();
    return r;
  }

  if (!Update.begin((size_t)len, U_FLASH)) {
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
