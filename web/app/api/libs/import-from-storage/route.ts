import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  LIBS_BUCKET,
  isVehicleLibPayload,
  insertLibraryIntoDb,
} from "@/lib/libs-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Re-importa una libreria da Storage nel DB (per ripristino o aggiornamento). */
export async function POST(request: NextRequest) {
  let body: { path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON non valido" }, { status: 400 });
  }

  const path = typeof body?.path === "string" ? body.path.trim() : "";
  if (!path || !path.endsWith(".json")) {
    return NextResponse.json({ ok: false, error: "Inserisci path del file .json in Storage (es. hyundai_kona_ev.json)" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database non configurato" }, { status: 503 });
  }

  const { data: blob, error: downloadErr } = await supabase.storage.from(LIBS_BUCKET).download(path);
  if (downloadErr || !blob) {
    return NextResponse.json(
      { ok: false, error: downloadErr?.message ?? "File non trovato in Storage" },
      { status: 404 }
    );
  }

  let text: string;
  try {
    text = await blob.text();
  } catch {
    return NextResponse.json({ ok: false, error: "Impossibile leggere il file" }, { status: 400 });
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Il contenuto non è un JSON valido" }, { status: 400 });
  }

  if (!isVehicleLibPayload(data)) {
    return NextResponse.json(
      { ok: false, error: "Il JSON non ha il formato libreria (make, model, signals, dtc)." },
      { status: 400 }
    );
  }

  const sourceLabel = `storage:${path}`;

  try {
    const { vehicleId, signalsAdded, dtcAdded } = await insertLibraryIntoDb(supabase, data, sourceLabel);
    return NextResponse.json({
      ok: true,
      vehicle_id: vehicleId,
      make: data.make,
      model: data.model,
      signalsAdded,
      dtcAdded,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore import";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
