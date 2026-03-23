import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehicleConnectionStatus } from "@/lib/types";

/** Allineato al ciclo ingest ESP (~1 s) + margine rete. */
export const LIVE_DATA_MAX_AGE_MS = 60_000;
/** Prima che arrivino righe in readings/can_frames. */
export const PENDING_SESSION_GRACE_MS = 120_000;

export function resolveConnectionStatus(
  session: { started_at: string },
  lastDataAt: Date | null,
  nowMs: number
): VehicleConnectionStatus {
  const started = new Date(session.started_at).getTime();
  const hasTelemetry = lastDataAt !== null;
  if (hasTelemetry && nowMs - lastDataAt!.getTime() <= LIVE_DATA_MAX_AGE_MS) {
    return "live";
  }
  if (!hasTelemetry && nowMs - started <= PENDING_SESSION_GRACE_MS) {
    return "pending";
  }
  return "offline";
}

/** Ultimo timestamp tra letture sessione e frame CAN dispositivo (stesso criterio dashboard). */
export async function fetchLastDataAtForSession(
  supabase: SupabaseClient,
  sessionId: string,
  deviceId: string
): Promise<Date | null> {
  const [{ data: lastReadingRow }, { data: lastCanRow }] = await Promise.all([
    supabase
      .from("readings")
      .select("recorded_at")
      .eq("session_id", sessionId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("can_frames")
      .select("recorded_at")
      .eq("device_id", deviceId.trim())
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const tRead = lastReadingRow?.recorded_at
    ? new Date(lastReadingRow.recorded_at as string)
    : null;
  const tCan = lastCanRow?.recorded_at ? new Date(lastCanRow.recorded_at as string) : null;
  if (tRead && tCan) return tRead > tCan ? tRead : tCan;
  return tRead ?? tCan;
}

/** Testo compatto per UI (client e server). */
export function formatLastDataItaliano(d: Date, nowMs = Date.now()): string {
  const s = Math.floor((nowMs - d.getTime()) / 1000);
  if (s < 0) return "in arrivo";
  if (s < 8) return "adesso";
  if (s < 60) return `${s} s fa`;
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  return d.toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
