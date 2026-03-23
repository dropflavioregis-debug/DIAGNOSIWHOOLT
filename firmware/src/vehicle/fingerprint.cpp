#include "fingerprint.h"
#include "can/can_driver.h"
#include "config/config.h"
#include <Arduino.h>
#include <cstring>
#include <cstdio>

namespace ev_diag {

static bool idInList(const CanIdList& list, uint32_t id) {
  for (size_t i = 0; i < list.count; i++) {
    unsigned int v = 0;
    sscanf(list.ids[i], "%x", &v);
    if ((uint32_t)v == id) return true;
  }
  return false;
}

size_t collectCanIds(uint32_t timeoutMs, CanIdList& out) {
  out.count = 0;
  if (!canIsStarted()) return 0;

  const unsigned long deadline = millis() + timeoutMs;
  uint32_t id;
  uint8_t len;
  uint8_t data[8];

  while (millis() < deadline && out.count < CanIdList::MAX_IDS) {
    if (canReceive(&id, &len, data, sizeof(data))) {
      if (!idInList(out, id)) {
        snprintf(out.ids[out.count], sizeof(out.ids[0]), "0x%lX", (unsigned long)id);
        out.count++;
      }
    }
    delay(1);
  }
  return out.count;
}

bool canIdsToJson(const CanIdList& list, char* outBuf, size_t outLen) {
  if (!outBuf || outLen < 5) return false;
  size_t n = 0;
  n += snprintf(outBuf + n, outLen - n, "{\"can_ids\":[");
  for (size_t i = 0; i < list.count && n < outLen - 2; i++) {
    if (i > 0) { outBuf[n++] = ','; outBuf[n] = '\0'; }
    n += snprintf(outBuf + n, outLen - n, "\"%s\"", list.ids[i]);
  }
  n += snprintf(outBuf + n, outLen - n, "]}");
  return n < outLen;
}

}  // namespace ev_diag
