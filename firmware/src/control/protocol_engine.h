#ifndef PROTOCOL_ENGINE_H
#define PROTOCOL_ENGINE_H

#include <cstddef>
#include <cstdint>

namespace ev_diag {

struct ProtocolSignalReading {
  char name[32];
  uint8_t raw[8];
  size_t rawLen;
  double value;
};

struct ProtocolRunResult {
  bool ok;
  size_t count;
  ProtocolSignalReading readings[16];
};

bool runProtocolProfileJson(const char* profileJson, ProtocolRunResult* out);

}  // namespace ev_diag

#endif  // PROTOCOL_ENGINE_H
