#ifndef COMMAND_DISPATCHER_H
#define COMMAND_DISPATCHER_H

#include <cstddef>
#include <cstdint>

namespace ev_diag {

enum class DeviceCommandType {
  Unknown = 0,
  StartSession,
  SetSniffer,
  ReadVin,
  ReadDtc,
  RunProfile
};

struct ParsedDeviceCommand {
  DeviceCommandType type;
  bool hasSnifferActive;
  bool snifferActive;
  char profileId[64];
  int profileVersion;
};

struct ParsedDeviceCommands {
  ParsedDeviceCommand commands[8];
  size_t count;
};

bool parseDeviceCommandsJson(const char* json, ParsedDeviceCommands* out);

}  // namespace ev_diag

#endif  // COMMAND_DISPATCHER_H
