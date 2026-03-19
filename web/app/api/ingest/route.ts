import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface IngestBody {
  device_id?: string;
  session_id?: string;
  vehicle_id?: string;
  can_fingerprint?: unknown;
  readings?: Array<{ signal_id?: string; name?: string; value?: number; raw_value?: string }>;
  raw_dtc?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as IngestBody;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid body: expected JSON object" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({
        ok: true,
        received_at: new Date().toISOString(),
        message: "Ingest accepted (Supabase not configured, not persisted)",
      });
    }

    const deviceId = body.device_id ?? "unknown";
    const vehicleId = body.vehicle_id ?? null;
    const canFingerprint = body.can_fingerprint ?? null;
    const rawDtc = Array.isArray(body.raw_dtc) ? body.raw_dtc : [];
    const readings = Array.isArray(body.readings) ? body.readings : [];

    let sessionId = body.session_id ?? null;
    if (!sessionId) {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          device_id: deviceId,
          vehicle_id: vehicleId,
          can_fingerprint: canFingerprint,
          raw_dtc: rawDtc,
        })
        .select("id")
        .single();
      if (sessionError) {
        return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
      }
      sessionId = session?.id ?? null;
    } else {
      await supabase
        .from("sessions")
        .update({ raw_dtc: rawDtc })
        .eq("id", sessionId);
    }

    if (sessionId && readings.length > 0) {
      const rows = readings
        .filter((r) => r.signal_id && typeof r.value === "number")
        .map((r) => ({
          session_id: sessionId,
          signal_id: r.signal_id,
          value: r.value as number,
          raw_value: r.raw_value ?? null,
        }));
      if (rows.length > 0) {
        await supabase.from("readings").insert(rows);
      }
    }

    return NextResponse.json({
      ok: true,
      received_at: new Date().toISOString(),
      session_id: sessionId,
      message: "Data persisted",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
}
