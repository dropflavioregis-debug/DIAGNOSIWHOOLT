#include "api_client.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <cstring>

namespace ev_diag {

static String urlStripTrailingSlash(const char* base) {
  String s = base;
  while (s.endsWith("/")) s.remove(s.length() - 1);
  return s;
}

static bool doPost(const char* serverUrl, const char* apiKey, const char* path,
                   const char* jsonBody, int* outCode) {
  if (!WiFi.isConnected()) return false;

  String base = urlStripTrailingSlash(serverUrl);
  String url = base + path;

  HTTPClient http;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  if (apiKey && apiKey[0] != '\0')
    http.addHeader("X-API-Key", apiKey);

  int code = http.POST(jsonBody ? jsonBody : "{}");
  if (outCode) *outCode = code;
  http.end();
  return (code >= 200 && code < 300);
}

static bool doGet(const char* serverUrl, const char* apiKey, const char* path,
                  char* outBuf, size_t outLen, int* outCode) {
  if (!WiFi.isConnected() || !outBuf || outLen == 0) return false;

  String base = urlStripTrailingSlash(serverUrl);
  String url = base + path;

  HTTPClient http;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (apiKey && apiKey[0] != '\0')
    http.addHeader("X-API-Key", apiKey);

  int code = http.GET();
  if (outCode) *outCode = code;
  bool ok = (code >= 200 && code < 300);
  if (ok) {
    String payload = http.getString();
    size_t copyLen = (payload.length() < outLen - 1) ? payload.length() : outLen - 1;
    memcpy(outBuf, payload.c_str(), copyLen);
    outBuf[copyLen] = '\0';
  }
  http.end();
  return ok;
}

bool postIngest(const char* serverUrl, const char* apiKey, const char* jsonBody) {
  int code;
  bool ok = doPost(serverUrl, apiKey, "/api/ingest", jsonBody, &code);
  if (!ok && HTTP_MAX_RETRIES > 0) {
    delay(500);
    ok = doPost(serverUrl, apiKey, "/api/ingest", jsonBody, &code);
  }
  return ok;
}

bool postVehicleDetect(const char* serverUrl, const char* apiKey, const char* jsonBody) {
  int code;
  bool ok = doPost(serverUrl, apiKey, "/api/vehicle/detect", jsonBody, &code);
  if (!ok && HTTP_MAX_RETRIES > 0) {
    delay(500);
    ok = doPost(serverUrl, apiKey, "/api/vehicle/detect", jsonBody, &code);
  }
  return ok;
}

bool getLibJson(const char* serverUrl, const char* apiKey, const char* vehicleId,
                char* outBuf, size_t outLen) {
  if (!vehicleId || vehicleId[0] == '\0') return false;
  String path = String("/api/libs/") + vehicleId;
  int code;
  bool ok = doGet(serverUrl, apiKey, path.c_str(), outBuf, outLen, &code);
  if (!ok && HTTP_MAX_RETRIES > 0) {
    delay(500);
    ok = doGet(serverUrl, apiKey, path.c_str(), outBuf, outLen, &code);
  }
  return ok;
}

}  // namespace ev_diag
