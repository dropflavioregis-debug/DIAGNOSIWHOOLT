import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const deviceId = (searchParams.get("device_id") ?? "").trim();
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "device_id is required" }, { status: 400 });
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("device_profile_assignment")
    .select("profile_id, pinned_version, auto_apply")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (assignmentError) return NextResponse.json({ ok: false, error: assignmentError.message }, { status: 500 });
  if (!assignment?.profile_id) return NextResponse.json({ ok: true, profile: null });

  const versionsQuery = supabase
    .from("protocol_profile_versions")
    .select("id, version, payload, is_active, created_at")
    .eq("profile_id", assignment.profile_id)
    .order("version", { ascending: false })
    .limit(1);
  const { data: latest, error: latestError } = await versionsQuery.maybeSingle();
  if (latestError) return NextResponse.json({ ok: false, error: latestError.message }, { status: 500 });

  const selectedVersion = typeof assignment.pinned_version === "number"
    ? assignment.pinned_version
    : latest?.version;

  const { data: versionRow, error: versionError } = await supabase
    .from("protocol_profile_versions")
    .select("id, version, payload, is_active, created_at")
    .eq("profile_id", assignment.profile_id)
    .eq("version", selectedVersion ?? -1)
    .maybeSingle();
  if (versionError) return NextResponse.json({ ok: false, error: versionError.message }, { status: 500 });

  if (!versionRow) return NextResponse.json({ ok: true, profile: null });

  return NextResponse.json({
    ok: true,
    profile: {
      profile_id: assignment.profile_id,
      version: versionRow.version,
      payload: versionRow.payload,
      source: typeof assignment.pinned_version === "number" ? "pinned" : "latest",
    },
  });
}
