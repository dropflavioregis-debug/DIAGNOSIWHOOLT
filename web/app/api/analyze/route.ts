import { NextRequest, NextResponse } from "next/server";
import { analyzeWithClaude } from "@/lib/claude";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      raw_dtc?: string[];
      signals?: Record<string, unknown>;
      context?: string;
      session_id?: string;
    };
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid body: expected JSON object" },
        { status: 400 }
      );
    }

    const diagnosis = await analyzeWithClaude({
      raw_dtc: body.raw_dtc,
      signals: body.signals,
      context: body.context,
    });

    const supabase = getSupabase();
    if (supabase && body.session_id) {
      await supabase
        .from("sessions")
        .update({ ai_diagnosis: diagnosis })
        .eq("id", body.session_id);
    }

    return NextResponse.json({
      ok: true,
      diagnosis,
      summary: diagnosis.slice(0, 200) + (diagnosis.length > 200 ? "…" : ""),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
