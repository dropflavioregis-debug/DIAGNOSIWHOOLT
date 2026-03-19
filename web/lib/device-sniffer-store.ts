/**
 * In-memory store for per-device sniffer state (web → ESP32 via GET /api/device/commands).
 * POST/DELETE /api/can-sniffer/subscribe update this; GET /api/device/commands reads it.
 */

const snifferActiveByDevice = new Map<string, boolean>();

export function getSnifferActive(deviceId: string): boolean {
  if (!deviceId || typeof deviceId !== "string") return false;
  return snifferActiveByDevice.get(deviceId.trim()) ?? false;
}

export function setSnifferActive(deviceId: string, active: boolean): void {
  if (!deviceId || typeof deviceId !== "string") return;
  const key = deviceId.trim();
  if (active) {
    snifferActiveByDevice.set(key, true);
  } else {
    snifferActiveByDevice.delete(key);
  }
}
