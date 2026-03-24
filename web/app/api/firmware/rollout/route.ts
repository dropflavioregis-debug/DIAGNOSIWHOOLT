import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { auditRuntime, logDeviceUpdateEvent } from "@/lib/control-plane";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const channel = (searchParams.get("channel") ?? "stable").trim();
  const { data, error } = await supabase
    .from("firmware_rollout_rules")
    .select("*")
    .eq("channel", channel)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rules: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const body = (await request.json()) as {
    channel?: string;
    rollout_mode?: string;
    allow_auto?: boolean;
    allowlist_devices?: string[];
    target_version?: string;
    binary_url?: string;
    binary_md5?: string;
    min_supported_version?: string;
    rollout_group?: string;
    metadata?: unknown;
  };
  const channel = (body.channel ?? "stable").trim();
  const targetVersion = (body.target_version ?? "").trim();
  const binaryUrl = (body.binary_url ?? "").trim();
  if (!targetVersion || !binaryUrl) {
    return NextResponse.json({ ok: false, error: "target_version and binary_url are required" }, { status: 400 });
  }
  const allowlistDevices = Array.isArray(body.allowlist_devices)
    ? body.allowlist_devices.map((d) => d.trim()).filter((d) => d.length > 0)
    : [];
  const payload = {
    channel,
    rollout_mode: body.rollout_mode ?? "manual",
    allow_auto: Boolean(body.allow_auto),
    allowlist_devices: allowlistDevices,
    target_version: targetVersion,
    binary_url: binaryUrl,
    binary_md5: body.binary_md5 ?? null,
    min_supported_version: body.min_supported_version ?? null,
    rollout_group: body.rollout_group ?? null,
    metadata: body.metadata ?? {},
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("firmware_rollout_rules").insert(payload).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  for (const deviceId of allowlistDevices) {
    await logDeviceUpdateEvent(deviceId, "rollout_rule_updated", "info", targetVersion, {
      channel,
      rollout_mode: payload.rollout_mode,
      allow_auto: payload.allow_auto,
    });
    await auditRuntime(deviceId, "dashboard", "firmware_rollout_rule", payload);
  }

  return NextResponse.json({ ok: true, rule: data });
}
