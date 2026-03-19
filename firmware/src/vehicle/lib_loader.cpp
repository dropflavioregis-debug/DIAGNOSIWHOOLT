#include "lib_loader.h"
#include <LittleFS.h>
#include <cstring>
#include <cstdio>

namespace ev_diag {

static bool s_fsMounted = false;

bool libLoaderInit() {
  if (s_fsMounted) return true;
  s_fsMounted = LittleFS.begin(false);
  return s_fsMounted;
}

static void libFilePath(char* path, size_t pathLen, const char* vehicleId) {
  snprintf(path, pathLen, "%s%s.json", LIB_PATH_PREFIX, vehicleId);
}

bool loadLibFromSpiffs(const char* vehicleId, char* outBuf, size_t outLen) {
  if (!s_fsMounted || !vehicleId || !outBuf || outLen == 0) return false;

  char path[64];
  libFilePath(path, sizeof(path), vehicleId);

  File f = LittleFS.open(path, "r");
  if (!f) return false;

  size_t n = f.read((uint8_t*)outBuf, outLen - 1);
  f.close();
  outBuf[n] = '\0';
  return true;
}

bool saveLibToSpiffs(const char* vehicleId, const char* json, size_t len) {
  if (!s_fsMounted || !vehicleId || !json) return false;

  char path[64];
  libFilePath(path, sizeof(path), vehicleId);

  if (!LittleFS.exists(LIB_PATH_PREFIX))
    LittleFS.mkdir(LIB_PATH_PREFIX);

  File f = LittleFS.open(path, "w");
  if (!f) return false;
  size_t toWrite = len;
  if (toWrite == 0) toWrite = strlen(json);
  size_t written = f.write((const uint8_t*)json, toWrite);
  f.close();
  return written == toWrite;
}

bool hasLibInSpiffs(const char* vehicleId) {
  if (!s_fsMounted || !vehicleId) return false;
  char path[64];
  libFilePath(path, sizeof(path), vehicleId);
  return LittleFS.exists(path);
}

}  // namespace ev_diag
