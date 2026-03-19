"use server";

import { getSupabase } from "@/lib/supabase";
import { queueSnifferStateCommand } from "@/lib/device-sniffer-state";
import { getFrames, appendFrames, type CanFrame } from "@/lib/can-sniffer-frames-store";

export async function subscribeSniffer(deviceId: string): Promise<{ ok: boolean; error?: string }> {
  if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
    return { ok: false, error: "device_id required" };
  }
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Database not configured" };
  const result = await queueSnifferStateCommand(supabase, deviceId.trim(), true);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function unsubscribeSniffer(deviceId: string): Promise<{ ok: boolean; error?: string }> {
  if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
    return { ok: false, error: "device_id required" };
  }
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Database not configured" };
  const result = await queueSnifferStateCommand(supabase, deviceId.trim(), false);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function getCanSnifferFrames(
  deviceId: string,
  limit = 500
): Promise<{ ok: boolean; frames: CanFrame[]; error?: string }> {
  if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
    return { ok: false, frames: [], error: "device_id required" };
  }
  const frames = getFrames(deviceId.trim(), limit);
  return { ok: true, frames };
}

export async function importCanSnifferFrames(
  deviceId: string,
  frames: Array<{ id: number; len: number; data: number[] }>
): Promise<{ ok: boolean; count?: number; error?: string }> {
  if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
    return { ok: false, error: "device_id required" };
  }
  if (!Array.isArray(frames) || frames.length === 0) {
    return { ok: false, count: 0, error: "Nessun frame da importare" };
  }
  const normalized = frames.map((f) => ({
    id: Number(f.id),
    len: Number(f.len),
    data: Array.isArray(f.data) ? f.data.slice(0, 8).map(Number) : [],
  }));
  appendFrames(deviceId.trim(), normalized);
  return { ok: true, count: normalized.length };
}
