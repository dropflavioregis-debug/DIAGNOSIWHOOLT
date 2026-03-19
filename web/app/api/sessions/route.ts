import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ sessions: [], message: "Supabase not configured" });
  }
  const { data, error } = await supabase
    .from("sessions")
    .select("id, device_id, vehicle_id, started_at, ended_at, raw_dtc, ai_diagnosis")
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ sessions: data ?? [] });
}
