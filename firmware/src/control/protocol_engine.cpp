#include "protocol_engine.h"
#include "uds/uds_client.h"
#include <ArduinoJson.h>
#include <cstring>

namespace ev_diag {

static bool parseDidString(const char* str, uint16_t* outDid) {
  if (!str || !outDid) return false;
  unsigned int v = 0;
  if (strncmp(str, "0x", 2) == 0 || strncmp(str, "0X", 2) == 0) str += 2;
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

bool runProtocolProfileJson(const char* profileJson, ProtocolRunResult* out) {
  if (!profileJson || !out) return false;
  out->ok = false;
  out->count = 0;
  StaticJsonDocument<4096> doc;
  if (deserializeJson(doc, profileJson) != DeserializationError::Ok) return false;
  JsonArray steps = doc["payload"]["steps"].as<JsonArray>();
  if (steps.isNull()) steps = doc["steps"].as<JsonArray>();
  if (steps.isNull()) return false;

  for (JsonVariant v : steps) {
    if (out->count >= 16) break;
    JsonObject step = v.as<JsonObject>();
    if (step.isNull()) continue;
    const char* action = step["action"] | "";
    if (strcmp(action, "read_did") != 0) continue;

    const char* didStr = step["did"] | "";
    const char* name = step["name"] | "";
    uint16_t did = 0;
    if (!parseDidString(didStr, &did) || !name || name[0] == '\0') continue;

    uint8_t raw[8];
    size_t rawLen = 0;
    if (!readDataByIdentifier(did, raw, sizeof(raw), &rawLen) || rawLen == 0) continue;

    ProtocolSignalReading reading = {};
    strncpy(reading.name, name, sizeof(reading.name) - 1);
    reading.name[sizeof(reading.name) - 1] = '\0';
    reading.rawLen = rawLen > 8 ? 8 : rawLen;
    for (size_t i = 0; i < reading.rawLen; i++) reading.raw[i] = raw[i];
    if (reading.rawLen >= 2) reading.value = (double)((raw[0] << 8) | raw[1]);
    else reading.value = (double)raw[0];

    out->readings[out->count++] = reading;
  }
  out->ok = out->count > 0;
  return out->ok;
}

}  // namespace ev_diag
