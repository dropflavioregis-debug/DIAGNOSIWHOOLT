"use server";

import { getSupabase } from "@/lib/supabase";
import { queueSnifferStateCommand, getSnifferActiveState } from "@/lib/device-sniffer-state";
import { getFrames, appendFrames, type CanFrame } from "@/lib/can-sniffer-frames-store";
import { fetchRecentCanFramesFromDb, insertCanFramesToDb } from "@/lib/can-frames-db";

function frameDedupKey(f: CanFrame): string {
  return `${f.ts}|${f.id}|${f.len}|${(f.data ?? []).join(",")}`;
}

/** DB (multi-istanza) + memoria (stessa istanza, prima del commit) → log completo. */
function mergeDbAndMemoryFrames(fromDb: CanFrame[], fromMem: CanFrame[], limit: number): CanFrame[] {
  if (fromMem.length === 0) return fromDb.slice(-limit);
  if (fromDb.length === 0) return fromMem.slice(-limit);
  const seen = new Set<string>();
  const merged = [...fromDb, ...fromMem];
  merged.sort((a, b) => {
    const ta = new Date(a.ts).getTime();
    const tb = new Date(b.ts).getTime();
    return ta - tb;
  });
  const out: CanFrame[] = [];
  for (const f of merged) {
    const k = frameDedupKey(f);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out.slice(-limit);
}

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
  const trimmed = deviceId.trim();
  const supabase = getSupabase();
  const fromMem = getFrames(trimmed, limit);
  if (supabase) {
    const fromDb = await fetchRecentCanFramesFromDb(supabase, trimmed, limit);
    const merged = mergeDbAndMemoryFrames(fromDb, fromMem, limit);
    return { ok: true, frames: merged };
  }
  return { ok: true, frames: fromMem };
}

/** Allineamento UI ↔ DB: stato sniffer come ultimo comando set_sniffer (stesso criterio dell’ESP32). */
export async function getSnifferSubscriptionState(
  deviceId: string
): Promise<{ ok: boolean; active: boolean }> {
  if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
    return { ok: false, active: false };
  }
  const supabase = getSupabase();
  if (!supabase) return { ok: false, active: false };
  const active = await getSnifferActiveState(supabase, deviceId.trim());
  return { ok: true, active };
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
  const trimmed = deviceId.trim();
  const supabase = getSupabase();
  if (supabase) {
    const ins = await insertCanFramesToDb(supabase, trimmed, normalized);
    if (ins.error) {
      return { ok: false, error: ins.error };
    }
  }
  appendFrames(trimmed, normalized);
  return { ok: true, count: normalized.length };
}
