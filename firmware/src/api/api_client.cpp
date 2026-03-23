#include "api_client.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <cstdio>
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

static bool doPostWithResponse(const char* serverUrl, const char* apiKey, const char* path,
                               const char* jsonBody, char* outBuf, size_t outLen, int* outCode) {
  if (!WiFi.isConnected() || !outBuf || outLen == 0) return false;

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

bool postIngestWithResponse(const char* serverUrl, const char* apiKey, const char* jsonBody,
                            char* outBuf, size_t outLen) {
  int code;
  bool ok = doPostWithResponse(serverUrl, apiKey, "/api/ingest", jsonBody, outBuf, outLen, &code);
  if (!ok && HTTP_MAX_RETRIES > 0) {
    delay(500);
    ok = doPostWithResponse(serverUrl, apiKey, "/api/ingest", jsonBody, outBuf, outLen, &code);
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

bool postVehicleDetectWithResponse(const char* serverUrl, const char* apiKey, const char* jsonBody,
                                  char* outBuf, size_t outLen) {
  if (!outBuf || outLen == 0) return false;
  int code;
  bool ok = doPostWithResponse(serverUrl, apiKey, "/api/vehicle/detect", jsonBody, outBuf, outLen, &code);
  if (!ok && HTTP_MAX_RETRIES > 0) {
    delay(500);
    ok = doPostWithResponse(serverUrl, apiKey, "/api/vehicle/detect", jsonBody, outBuf, outLen, &code);
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

bool getDeviceCommands(const char* serverUrl, const char* apiKey, const char* deviceId,
                      char* outBuf, size_t outLen) {
  if (!deviceId || deviceId[0] == '\0' || !outBuf || outLen == 0) return false;
  String path = String("/api/device/commands?device_id=") + deviceId;
  int code;
  bool ok = doGet(serverUrl, apiKey, path.c_str(), outBuf, outLen, &code);
  if (!ok && HTTP_MAX_RETRIES > 0) {
    delay(500);
    ok = doGet(serverUrl, apiKey, path.c_str(), outBuf, outLen, &code);
  }
  return ok;
}

bool postCanSnifferStream(const char* serverUrl, const char* apiKey, const char* deviceId,
                          const char* sessionId, const CanSnifferFrame* frames, size_t numFrames) {
  if (!serverUrl || !deviceId || deviceId[0] == '\0' || !frames || numFrames == 0) return false;
  if (!WiFi.isConnected()) return false;

  static char bodyBuf[2300];
  char* p = bodyBuf;
  size_t remain = sizeof(bodyBuf);
  int n;
  if (sessionId && sessionId[0] != '\0') {
    n = snprintf(p, remain, "{\"device_id\":\"%s\",\"session_id\":\"%s\",\"frames\":[", deviceId, sessionId);
  } else {
    n = snprintf(p, remain, "{\"device_id\":\"%s\",\"frames\":[", deviceId);
  }
  if (n < 0 || (size_t)n >= remain) return false;
  p += n;
  remain -= (size_t)n;

  bool firstFrame = true;
  for (size_t i = 0; i < numFrames; i++) {
    const CanSnifferFrame* f = &frames[i];
    if (f->len > 8) continue;
    const size_t need = (size_t)(48 + f->len * 4 + (f->extended ? 20u : 0u));
    if (remain < need) break;
    n = snprintf(p, remain, "%s{\"id\":%lu,\"len\":%u,\"data\":[",
                 firstFrame ? "" : ",", (unsigned long)f->id, (unsigned)f->len);
    if (n < 0 || (size_t)n >= remain) break;
    p += n;
    remain -= (size_t)n;
    for (uint8_t j = 0; j < f->len; j++) {
      n = snprintf(p, remain, "%s%u", j > 0 ? "," : "", (unsigned)f->data[j]);
      if (n < 0 || (size_t)n >= remain) return false;
      p += n;
      remain -= (size_t)n;
    }
    if (f->extended) {
      n = snprintf(p, remain, "],\"extended\":true}");
    } else {
      n = snprintf(p, remain, "]}");
    }
    if (n < 0 || (size_t)n >= remain) return false;
    p += n;
    remain -= (size_t)n;
    firstFrame = false;
  }
  n = snprintf(p, remain, "]}");
  if (n < 0 || (size_t)n >= remain) return false;

  int code;
  bool ok = doPost(serverUrl, apiKey, "/api/can-sniffer/stream", bodyBuf, &code);
  return ok;
}

}  // namespace ev_diag
