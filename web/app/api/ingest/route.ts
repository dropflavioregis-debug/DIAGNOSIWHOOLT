import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { decodeVin, isValidVinLength } from "@/lib/vin-decode";
import { getSnifferActiveState } from "@/lib/device-sniffer-state";

export const dynamic = "force-dynamic";

interface IngestBody {
  device_id?: string;
  session_id?: string;
  vehicle_id?: string;
  can_fingerprint?: unknown;
  vin?: string;
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

    const deviceId = body.device_id ?? "unknown";
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({
        ok: true,
        received_at: new Date().toISOString(),
        sniffer_active: false,
        message: "Ingest accepted (Supabase not configured, not persisted)",
      });
    }

    const vehicleId = body.vehicle_id ?? null;
    const snifferActive = await getSnifferActiveState(supabase, deviceId);
    const canFingerprint = body.can_fingerprint ?? null;
    const rawDtc = Array.isArray(body.raw_dtc) ? body.raw_dtc : [];
    const readings = Array.isArray(body.readings) ? body.readings : [];
    const rawVin = typeof body.vin === "string" ? body.vin.trim().toUpperCase() : null;
    const hasVin = rawVin !== null && isValidVinLength(rawVin);
    const vinDecoded = hasVin ? await decodeVin(rawVin) : null;

    const sessionPayload = {
      device_id: deviceId,
      vehicle_id: vehicleId,
      can_fingerprint: canFingerprint,
      raw_dtc: rawDtc,
      ...(hasVin && rawVin && { vin: rawVin }),
      ...(vinDecoded && { vin_decoded: vinDecoded }),
    };

    let sessionId = body.session_id ?? null;
    if (!sessionId) {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert(sessionPayload)
        .select("id")
        .single();
      if (sessionError) {
        return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
      }
      sessionId = session?.id ?? null;
    } else {
      await supabase
        .from("sessions")
        .update({
          raw_dtc: rawDtc,
          ...(hasVin && rawVin && { vin: rawVin }),
          ...(vinDecoded && { vin_decoded: vinDecoded }),
        })
        .eq("id", sessionId);
    }

    if (sessionId && readings.length > 0) {
      let sessionVehicleId: string | null = vehicleId;
      if (!sessionVehicleId) {
        const { data: sessionRow } = await supabase
          .from("sessions")
          .select("vehicle_id")
          .eq("id", sessionId)
          .single();
        sessionVehicleId = sessionRow?.vehicle_id ?? null;
      }
      const rows: Array<{
        session_id: string;
        signal_id: string;
        value: number;
        raw_value: string | null;
      }> = [];
      for (const r of readings) {
        if (typeof r.value !== "number") continue;
        let signalId: string | null = r.signal_id ?? null;
        if (!signalId && r.name && sessionVehicleId) {
          const { data: sig } = await supabase
            .from("signals")
            .select("id")
            .eq("vehicle_id", sessionVehicleId)
            .eq("name", r.name)
            .limit(1)
            .maybeSingle();
          signalId = sig?.id ?? null;
        }
        if (signalId) {
          rows.push({
            session_id: sessionId,
            signal_id: signalId,
            value: r.value,
            raw_value: r.raw_value ?? null,
          });
        }
      }
      if (rows.length > 0) {
        await supabase.from("readings").insert(rows);
      }
    }

    return NextResponse.json({
      ok: true,
      received_at: new Date().toISOString(),
      session_id: sessionId,
      sniffer_active: snifferActive,
      message: "Data persisted",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
}
