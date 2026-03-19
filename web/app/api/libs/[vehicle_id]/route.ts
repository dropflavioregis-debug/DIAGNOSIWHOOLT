import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ vehicle_id: string }> }
) {
  const { vehicle_id } = await params;
  if (!vehicle_id) {
    return NextResponse.json(
      { ok: false, error: "Missing vehicle_id" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({
      vehicle_id,
      signals: [],
      dtc: [],
      message: "Supabase not configured",
    });
  }

  const [signalsRes, dtcRes] = await Promise.all([
    supabase.from("signals").select("name, description, did, ecu_address, formula, unit, min_value, max_value, category").eq("vehicle_id", vehicle_id),
    supabase.from("dtc").select("code, description_it, description_en, severity, system, possible_causes").eq("vehicle_id", vehicle_id),
  ]);

  const signals = (signalsRes.data ?? []).map((s) => ({
    name: s.name,
    description: s.description ?? undefined,
    did: s.did ?? undefined,
    ecu_address: s.ecu_address ?? undefined,
    formula: s.formula ?? undefined,
    unit: s.unit ?? undefined,
    min_value: s.min_value ?? undefined,
    max_value: s.max_value ?? undefined,
    category: s.category ?? undefined,
  }));
  const dtc = (dtcRes.data ?? []).map((d) => ({
    code: d.code,
    description_it: d.description_it ?? undefined,
    description_en: d.description_en ?? undefined,
    severity: d.severity ?? undefined,
    system: d.system ?? undefined,
    possible_causes: d.possible_causes ?? undefined,
  }));

  return NextResponse.json({
    vehicle_id,
    signals,
    dtc,
  });
}
