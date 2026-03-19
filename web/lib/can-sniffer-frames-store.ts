/**
 * In-memory store for CAN frames per device (for CAN Sniffer dashboard).
 * Device POSTs to /api/can-sniffer/stream; dashboard GETs recent frames.
 */

const MAX_FRAMES_PER_DEVICE = 2000;

export interface CanFrame {
  id: number;
  len: number;
  data: number[];
  ts: string;
}

const framesByDevice = new Map<string, CanFrame[]>();

function getOrCreate(deviceId: string): CanFrame[] {
  let arr = framesByDevice.get(deviceId);
  if (!arr) {
    arr = [];
    framesByDevice.set(deviceId, arr);
  }
  return arr;
}

export function appendFrames(deviceId: string, frames: Omit<CanFrame, "ts">[]): void {
  if (!deviceId || typeof deviceId !== "string" || !Array.isArray(frames) || frames.length === 0)
    return;
  const key = deviceId.trim();
  const arr = getOrCreate(key);
  const now = new Date().toISOString();
  for (const f of frames) {
    arr.push({
      id: Number(f.id),
      len: Number(f.len),
      data: Array.isArray(f.data) ? f.data.map(Number) : [],
      ts: now,
    });
  }
  if (arr.length > MAX_FRAMES_PER_DEVICE) {
    arr.splice(0, arr.length - MAX_FRAMES_PER_DEVICE);
  }
}

export function getFrames(deviceId: string, limit = 500): CanFrame[] {
  if (!deviceId || typeof deviceId !== "string") return [];
  const arr = framesByDevice.get(deviceId.trim());
  if (!arr) return [];
  const start = Math.max(0, arr.length - limit);
  return arr.slice(start);
}
