#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include "config/nvs_config.h"
#include <cstdint>

namespace ev_diag {

// Try to connect in STA mode using config. Returns true when connected.
// Call in loop for retry with backoff if disconnected.
bool wifiConnectSTA(const NvsConfig& cfg);

// Start AP and captive portal. Blocks serving config page until config saved and reboot.
// SSID = EV-Diagnostic-XXXX (last 4 hex digits of MAC).
void wifiStartAPAndCaptivePortal();

// True if connected in STA mode.
bool wifiIsConnected();

// Disconnect and stop (e.g. before switching to AP).
void wifiDisconnect();

// Retry interval in ms when STA connection lost.
constexpr uint32_t WIFI_RETRY_MS = 5000;

// Call in loop when in AP mode to process DNS and HTTP. Returns true if still in AP mode.
bool wifiManagerLoop();

// Start HTTP server on STA IP (port 80) with "Reconfigure" page. Call once after STA connected.
void wifiStartReconfigureServer();

// Call in loop when in STA to serve reconfigure page. Call when !wifiManagerLoop() && wifiIsConnected().
void wifiReconfigureLoop();

}  // namespace ev_diag

#endif  // WIFI_MANAGER_H
