#ifndef CAN_DRIVER_H
#define CAN_DRIVER_H

#include <cstddef>
#include <cstdint>

namespace ev_diag {

struct CanStatus {
  bool started;
  int speedKbps;
  uint32_t rxMissCount;
  uint32_t txErrorCounter;
  uint32_t rxErrorCounter;
  uint32_t txFailedCount;
  uint32_t rxOverrunCount;
  uint32_t arbLostCount;
  uint32_t busErrorCount;
  bool busOff;
  bool recovering;
};

// Initialize TWAI with given TX/RX GPIO and speed in kbps. Returns true on success.
bool canInit(int txGpio, int rxGpio, int speedKbps);

// Send one CAN frame (11- or 29-bit ID). Returns true on success.
bool canSend(uint32_t id, uint8_t len, const uint8_t* data);

// Receive one frame (non-blocking, timeout 0). Returns true if frame received.
// If extd_out is non-null, sets *extd_out for 29-bit extended identifiers.
bool canReceive(uint32_t* id, uint8_t* len, uint8_t* data, size_t dataMaxLen, bool* extd_out = nullptr);

// Stop and uninstall driver.
void canStop();

// True if driver was started successfully.
bool canIsStarted();

// Current configured CAN speed in kbps (0 if not configured yet).
int canGetSpeedKbps();

// Restart TWAI with same TX/RX and a new speed.
bool canReconfigureSpeed(int speedKbps);

// Fill status info from TWAI driver. Returns false when CAN is not started.
bool canGetStatus(CanStatus* outStatus);

}  // namespace ev_diag

#endif  // CAN_DRIVER_H
