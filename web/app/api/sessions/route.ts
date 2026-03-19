import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ReadingMetricRow = {
  session_id: string | null;
  value: number | null;
  signals:
    | { name?: string | null; unit?: string | null }
    | Array<{ name?: string | null; unit?: string | null }>
    | null;
};

const DISTANCE_NAME_HINTS = ["odometer", "odo", "distance", "mileage", "trip", "km"];
const ENERGY_NAME_HINTS = ["energy", "consum", "discharg", "kwh", "wh_used"];

function hasKeyword(value: string, keywords: string[]): boolean {
  return keywords.some((kw) => value.includes(kw));
}

function classifySignal(name: string, unit: string): "distance" | "energy" | null {
  const normalizedName = name.trim().toLowerCase();
  const normalizedUnit = unit.trim().toLowerCase();

  if (hasKeyword(normalizedName, DISTANCE_NAME_HINTS) || normalizedUnit === "km") {
    return "distance";
  }
  if (hasKeyword(normalizedName, ENERGY_NAME_HINTS) || normalizedUnit === "kwh") {
    return "energy";
  }
  return null;
}

function accumulateSessionRanges(valuesBySession: Map<string, number[]>): number {
  let total = 0;
  valuesBySession.forEach((values) => {
    if (!values.length) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const delta = max - min;
    if (Number.isFinite(delta) && delta > 0) total += delta;
  });
  return total;
}

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({
      sessions: [],
      metrics: {
        total_distance_km: 0,
        total_energy_kwh: 0,
        computed_from_readings: false,
      },
      message: "Supabase not configured",
    });
  }
  const { data, error } = await supabase
    .from("sessions")
    .select("id, device_id, vehicle_id, started_at, ended_at, raw_dtc, ai_diagnosis")
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const sessionIds = (data ?? []).map((s) => s.id);
  if (sessionIds.length === 0) {
    return NextResponse.json({
      sessions: [],
      metrics: {
        total_distance_km: 0,
        total_energy_kwh: 0,
        computed_from_readings: false,
      },
    });
  }

  const { data: readingRows } = await supabase
    .from("readings")
    .select("session_id, value, signals(name, unit)")
    .in("session_id", sessionIds);

  const distanceBySession = new Map<string, number[]>();
  const energyBySession = new Map<string, number[]>();

  for (const row of (readingRows ?? []) as ReadingMetricRow[]) {
    const sessionId = typeof row.session_id === "string" ? row.session_id : "";
    const value = typeof row.value === "number" ? row.value : NaN;
    if (!sessionId || !Number.isFinite(value)) continue;

    const signal = Array.isArray(row.signals) ? row.signals[0] : row.signals;
    const signalName = typeof signal?.name === "string" ? signal.name : "";
    const signalUnit = typeof signal?.unit === "string" ? signal.unit : "";
    const metricType = classifySignal(signalName, signalUnit);
    if (!metricType) continue;

    if (metricType === "distance") {
      const list = distanceBySession.get(sessionId) ?? [];
      list.push(value);
      distanceBySession.set(sessionId, list);
      continue;
    }

    const list = energyBySession.get(sessionId) ?? [];
    list.push(value);
    energyBySession.set(sessionId, list);
  }

  const totalDistance = accumulateSessionRanges(distanceBySession);
  const totalEnergy = accumulateSessionRanges(energyBySession);

  return NextResponse.json({
    sessions: data ?? [],
    metrics: {
      total_distance_km: Number(totalDistance.toFixed(1)),
      total_energy_kwh: Number(totalEnergy.toFixed(1)),
      computed_from_readings: distanceBySession.size > 0 || energyBySession.size > 0,
    },
  });
}
