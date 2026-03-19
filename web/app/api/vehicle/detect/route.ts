import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { detectVehicle } from "@/lib/vehicle-detect";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const canIds = body?.can_ids ?? body?.can_fingerprint;
    if (!Array.isArray(canIds) && typeof canIds !== "object") {
      return NextResponse.json(
        { ok: false, error: "Missing can_ids or can_fingerprint" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const match = await detectVehicle(supabase, canIds);
    if (!match) {
      return NextResponse.json(
        { ok: false, error: "Vehicle detection failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      vehicle_id: match.vehicle_id,
      make: match.make,
      model: match.model,
      lib_url: match.lib_url,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
}
