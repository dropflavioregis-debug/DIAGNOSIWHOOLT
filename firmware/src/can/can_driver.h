#ifndef CAN_DRIVER_H
#define CAN_DRIVER_H

#include <cstddef>
#include <cstdint>

namespace ev_diag {

// Initialize TWAI with given TX/RX GPIO and speed in kbps. Returns true on success.
bool canInit(int txGpio, int rxGpio, int speedKbps);

// Send one CAN frame (11- or 29-bit ID). Returns true on success.
bool canSend(uint32_t id, uint8_t len, const uint8_t* data);

// Receive one frame (non-blocking, timeout 0). Returns true if frame received.
bool canReceive(uint32_t* id, uint8_t* len, uint8_t* data, size_t dataMaxLen);

// Stop and uninstall driver.
void canStop();

// True if driver was started successfully.
bool canIsStarted();

}  // namespace ev_diag

#endif  // CAN_DRIVER_H
