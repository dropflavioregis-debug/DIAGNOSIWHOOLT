import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing session id" }, { status: 400 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !session) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Not found" }, { status: 404 });
  }
  const { data: readings } = await supabase
    .from("readings")
    .select("id, signal_id, value, raw_value, recorded_at")
    .eq("session_id", id)
    .order("recorded_at", { ascending: true });
  const out = readings ?? [];
  if (out.length > 0) {
    const signalIds = Array.from(new Set(out.map((r) => r.signal_id).filter(Boolean)));
    const { data: sigs } = await supabase.from("signals").select("id, name").in("id", signalIds);
    const nameById = new Map((sigs ?? []).map((s) => [s.id, s.name]));
    (out as Array<Record<string, unknown>>).forEach((r) => {
      r.name = nameById.get(r.signal_id as string) ?? null;
    });
  }
  return NextResponse.json({ ...session, readings: out });
}
