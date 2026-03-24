"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

type DashboardCommand =
  | "start_session"
  | "read_vin"
  | "read_dtc"
  | "set_sniffer"
  | "set_can_bitrate"
  | "can_debug_probe"
  | "can_bitrate_sweep";

interface QueueResult {
  ok: boolean;
  error?: string;
  message?: string;
}

async function insertDeviceCommand(
  deviceId: string,
  command: DashboardCommand,
  payload: unknown = null
): Promise<QueueResult> {
  const trimmedDeviceId = deviceId.trim();
  if (!trimmedDeviceId) {
    return { ok: false, error: "device_id mancante" };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "Database non configurato" };
  }
  const { error } = await supabase.from("device_commands").insert({
    device_id: trimmedDeviceId,
    command,
    payload,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/dashboard");
  return { ok: true, message: "Comando in coda. Il dispositivo lo leggera al prossimo polling." };
}

export async function queueDashboardCommand(
  deviceId: string,
  command: "start_session" | "read_vin" | "read_dtc"
): Promise<QueueResult> {
  return insertDeviceCommand(deviceId, command, null);
}

export async function setDashboardSniffer(
  deviceId: string,
  active: boolean
): Promise<QueueResult> {
  return insertDeviceCommand(deviceId, "set_sniffer", { active });
}

export async function setDashboardCanBitrate(
  deviceId: string,
  bitrateKbps: 125 | 250 | 500 | 1000
): Promise<QueueResult> {
  return insertDeviceCommand(deviceId, "set_can_bitrate", { bitrate_kbps: bitrateKbps });
}

export async function runDashboardCanProbe(
  deviceId: string,
  durationMs = 2000,
  bitrateKbps?: 125 | 250 | 500 | 1000
): Promise<QueueResult> {
  return insertDeviceCommand(deviceId, "can_debug_probe", {
    duration_ms: durationMs,
    ...(bitrateKbps ? { bitrate_kbps: bitrateKbps } : {}),
  });
}

export async function runDashboardCanSweep(
  deviceId: string,
  durationMs = 1200
): Promise<QueueResult> {
  return insertDeviceCommand(deviceId, "can_bitrate_sweep", { duration_ms: durationMs });
}
