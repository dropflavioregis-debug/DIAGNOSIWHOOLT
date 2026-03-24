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
  const limit = Math.min(200, Math.max(10, Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50));

  const updateQuery = supabase
    .from("device_update_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  const auditQuery = supabase
    .from("device_runtime_audit")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  const [{ data: updates, error: updatesError }, { data: audits, error: auditsError }] = await Promise.all([
    deviceId ? updateQuery.eq("device_id", deviceId) : updateQuery,
    deviceId ? auditQuery.eq("device_id", deviceId) : auditQuery,
  ]);

  if (updatesError) return NextResponse.json({ ok: false, error: updatesError.message }, { status: 500 });
  if (auditsError) return NextResponse.json({ ok: false, error: auditsError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    updates: updates ?? [],
    audits: audits ?? [],
  });
}
