import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanFrame } from "@/lib/can-sniffer-frames-store";

function hexToDataBytes(hex: string): number[] {
  const s = hex.replace(/\s/g, "");
  const out: number[] = [];
  for (let i = 0; i + 1 < s.length && out.length < 8; i += 2) {
    out.push(parseInt(s.slice(i, i + 2), 16) & 0xff);
  }
  return out;
}

/**
 * Ultimi frame CAN persistiti (POST /api/can-sniffer/stream).
 * Usato dalla dashboard invece del solo store in-memory, così funziona anche su serverless multi-istanza.
 */
export async function fetchRecentCanFramesFromDb(
  supabase: SupabaseClient,
  deviceId: string,
  limit: number
): Promise<CanFrame[]> {
  const lim = Math.min(Math.max(1, limit), 2000);
  const { data, error } = await supabase
    .from("can_frames")
    .select("can_id, len, data_hex, recorded_at")
    .eq("device_id", deviceId.trim())
    .order("recorded_at", { ascending: false })
    .limit(lim);

  if (error || !data?.length) return [];

  const chronological = [...data].reverse();
  return chronological.map((row) => {
    const rawBytes = hexToDataBytes(String(row.data_hex ?? ""));
    const len = Math.min(8, Math.max(0, Number(row.len) ?? rawBytes.length));
    return {
      id: Number(row.can_id),
      len,
      data: rawBytes.slice(0, len),
      ts:
        typeof row.recorded_at === "string"
          ? row.recorded_at
          : new Date().toISOString(),
    };
  });
}

export async function insertCanFramesToDb(
  supabase: SupabaseClient,
  deviceId: string,
  frames: Array<{ id: number; len: number; data: number[] }>
): Promise<{ inserted: number; error?: string }> {
  if (!frames.length) return { inserted: 0 };
  const rows = frames.map((f) => {
    const len = Math.min(8, Math.max(0, f.len));
    const bytes = (Array.isArray(f.data) ? f.data : []).slice(0, len).map((b) => Math.max(0, Math.min(255, Number(b))));
    const data_hex = Buffer.from(bytes).toString("hex");
    return {
      device_id: deviceId.trim(),
      can_id: f.id,
      extended: f.id > 0x7ff,
      len,
      data_hex,
    };
  });
  const { error } = await supabase.from("can_frames").insert(rows);
  if (error) return { inserted: 0, error: error.message };
  return { inserted: rows.length };
}
