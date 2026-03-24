import { getSupabase } from "@/lib/supabase";

export function isVersionAtLeast(current: string, minimum: string): boolean {
  const a = current.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const b = minimum.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return true;
}

export async function auditRuntime(
  deviceId: string,
  source: string,
  action: string,
  payload: unknown
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !deviceId.trim()) return;
  await supabase.from("device_runtime_audit").insert({
    device_id: deviceId.trim(),
    source,
    action,
    payload: payload ?? {},
  });
}

export async function logDeviceUpdateEvent(
  deviceId: string,
  eventType: string,
  status: string,
  firmwareVersion: string | null,
  details: unknown
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !deviceId.trim()) return;
  await supabase.from("device_update_events").insert({
    device_id: deviceId.trim(),
    event_type: eventType,
    status,
    firmware_version: firmwareVersion,
    details: details ?? {},
  });
}
