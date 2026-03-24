#include "command_dispatcher.h"
#include <ArduinoJson.h>
#include <cstring>

namespace ev_diag {

static DeviceCommandType decodeCommandType(const char* command) {
  if (!command) return DeviceCommandType::Unknown;
  if (strcmp(command, "start_session") == 0) return DeviceCommandType::StartSession;
  if (strcmp(command, "set_sniffer") == 0) return DeviceCommandType::SetSniffer;
  if (strcmp(command, "read_vin") == 0) return DeviceCommandType::ReadVin;
  if (strcmp(command, "read_dtc") == 0) return DeviceCommandType::ReadDtc;
  if (strcmp(command, "run_profile") == 0) return DeviceCommandType::RunProfile;
  return DeviceCommandType::Unknown;
}

bool parseDeviceCommandsJson(const char* json, ParsedDeviceCommands* out) {
  if (!json || !out) return false;
  out->count = 0;
  StaticJsonDocument<3072> doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok) return false;
  JsonArray commands = doc["commands"].as<JsonArray>();
  if (commands.isNull()) return false;

  for (JsonVariant v : commands) {
    if (out->count >= 8) break;
    JsonObject obj = v.as<JsonObject>();
    if (obj.isNull()) continue;
    ParsedDeviceCommand cmd = {};
    cmd.type = decodeCommandType(obj["command"] | "");
    cmd.hasSnifferActive = false;
    cmd.snifferActive = false;
    cmd.profileId[0] = '\0';
    cmd.profileVersion = -1;
    JsonObject payload = obj["payload"].as<JsonObject>();
    if (!payload.isNull()) {
      if (payload.containsKey("sniffer_active")) {
        cmd.hasSnifferActive = true;
        cmd.snifferActive = payload["sniffer_active"] | false;
      }
      const char* profileId = payload["profile_id"] | "";
      if (profileId && profileId[0] != '\0') {
        strncpy(cmd.profileId, profileId, sizeof(cmd.profileId) - 1);
        cmd.profileId[sizeof(cmd.profileId) - 1] = '\0';
      }
      cmd.profileVersion = payload["profile_version"] | -1;
    }
    out->commands[out->count++] = cmd;
  }
  return true;
}

}  // namespace ev_diag
