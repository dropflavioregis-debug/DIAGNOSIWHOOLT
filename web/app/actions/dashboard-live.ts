"use server";

import { getSupabase } from "@/lib/supabase";
import type { VehicleConnectionStatus } from "@/lib/types";
import {
  fetchLastDataAtForSession,
  resolveConnectionStatus,
} from "@/lib/dashboard-live";

/** Polling leggero per badge connesso/disconnesso e “ultimo dato” senza ricaricare tutta la pagina. */
export async function getDashboardLiveSnapshot(): Promise<{
  ok: boolean;
  connectionStatus: VehicleConnectionStatus;
  lastDataAt: string | null;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, connectionStatus: "none", lastDataAt: null };
  }
  const { data: sessionData } = await supabase
    .from("sessions")
    .select("id, device_id, started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sessionData) {
    return { ok: true, connectionStatus: "none", lastDataAt: null };
  }

  const row = sessionData as { id: string; device_id: string; started_at: string };
  const lastDataAt = await fetchLastDataAtForSession(supabase, row.id, row.device_id);
  const connectionStatus = resolveConnectionStatus(
    { started_at: row.started_at },
    lastDataAt,
    Date.now()
  );

  return {
    ok: true,
    connectionStatus,
    lastDataAt: lastDataAt?.toISOString() ?? null,
  };
}
