#ifndef FINGERPRINT_H
#define FINGERPRINT_H

#include <cstddef>
#include <cstdint>

namespace ev_diag {

// Collected CAN IDs as hex strings "0x7E8", etc. Filled by collectCanIds().
struct CanIdList {
  static const size_t MAX_IDS = 64;
  char ids[MAX_IDS][12];  // "0xXXX" or "0xXXXXXXXX"
  size_t count;
};

// Listen on CAN for timeoutMs, collect unique IDs. Returns count of IDs collected.
size_t collectCanIds(uint32_t timeoutMs, CanIdList& out);

// Build JSON array string for can_ids: ["0x7E8","0x123",...]. Writes into outBuf, max outLen. Returns true on success.
bool canIdsToJson(const CanIdList& list, char* outBuf, size_t outLen);

}  // namespace ev_diag

#endif  // FINGERPRINT_H
