import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  isVehicleLibPayload,
  insertLibraryIntoDb,
  uploadLibToStorage,
} from "@/lib/libs-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database non configurato" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Invia un file JSON (campo 'file')" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".json")) {
    return NextResponse.json({ ok: false, error: "Solo file .json consentiti" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "File troppo grande (max 5 MB)" }, { status: 400 });
  }

  let text: string;
  try {
    text = await file.text();
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
      {
        ok: false,
        error: "Il JSON deve contenere make, model (stringhe) e signals, dtc (array). Controlla il formato libreria.",
      },
      { status: 400 }
    );
  }

  const sourceLabel = `upload:${file.name}`;

  try {
    const { vehicleId, signalsAdded, dtcAdded } = await insertLibraryIntoDb(supabase, data, sourceLabel);

    try {
      await uploadLibToStorage(supabase, data.make, data.model, text);
    } catch (storageErr) {
      console.warn("Lib storage upload failed:", storageErr);
    }

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
