import type { SupabaseClient } from "@supabase/supabase-js";

type CommandRow = {
  payload: unknown;
};

function extractActiveFromPayload(payload: unknown): boolean | null {
  if (!payload || typeof payload !== "object") return null;
  const maybe = (payload as { active?: unknown }).active;
  return typeof maybe === "boolean" ? maybe : null;
}

export async function getSnifferActiveState(
  supabase: SupabaseClient,
  deviceId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("device_commands")
    .select("payload")
    .eq("device_id", deviceId)
    .eq("command", "set_sniffer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  const parsed = extractActiveFromPayload((data as CommandRow).payload);
  return parsed ?? false;
}

export async function queueSnifferStateCommand(
  supabase: SupabaseClient,
  deviceId: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("device_commands").insert({
    device_id: deviceId,
    command: "set_sniffer",
    payload: { active },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
