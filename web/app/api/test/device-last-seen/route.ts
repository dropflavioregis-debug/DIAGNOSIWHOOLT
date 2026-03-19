import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, device_id: null, started_at: null, message: "Supabase non configurato" },
      { status: 503 }
    );
  }
  const { data, error } = await supabase
    .from("sessions")
    .select("device_id, started_at")
    .neq("device_id", "test-dashboard")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, device_id: null, started_at: null, message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    ok: true,
    device_id: data?.device_id ?? null,
    started_at: data?.started_at ?? null,
    message: data
      ? `Ultimo dato da dispositivo "${data.device_id}"`
      : "Nessun dato ancora ricevuto da dispositivi (le sessioni di test dal pulsante «Test connessione ESP32» non contano).",
  });
}
