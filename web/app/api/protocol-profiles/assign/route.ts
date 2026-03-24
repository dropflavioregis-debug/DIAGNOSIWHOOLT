import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { auditRuntime } from "@/lib/control-plane";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const body = (await request.json()) as {
    device_id?: string;
    profile_id?: string;
    pinned_version?: number | null;
    channel?: string;
    auto_apply?: boolean;
    metadata?: unknown;
  };
  const deviceId = (body.device_id ?? "").trim();
  const profileId = (body.profile_id ?? "").trim();
  if (!deviceId || !profileId) {
    return NextResponse.json({ ok: false, error: "device_id and profile_id are required" }, { status: 400 });
  }

  const payload = {
    device_id: deviceId,
    profile_id: profileId,
    pinned_version: typeof body.pinned_version === "number" ? body.pinned_version : null,
    channel: body.channel ?? "stable",
    auto_apply: body.auto_apply ?? true,
    metadata: body.metadata ?? {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("device_profile_assignment")
    .upsert(payload, { onConflict: "device_id" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await auditRuntime(deviceId, "dashboard", "profile_assignment", payload);
  return NextResponse.json({ ok: true, assignment: data });
}
