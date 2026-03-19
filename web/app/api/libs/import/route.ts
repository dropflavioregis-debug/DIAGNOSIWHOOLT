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
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON non valido" }, { status: 400 });
  }

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ ok: false, error: "Inserisci l'URL del file JSON della libreria" }, { status: 400 });
  }

  if (!url.startsWith("https://")) {
    return NextResponse.json(
      { ok: false, error: "Solo URL HTTPS consentiti (es. raw.githubusercontent.com o link diretto al .json)" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database non configurato" }, { status: 503 });
  }

  let text: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "EV-Diagnostic-Import/1.0" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Errore nel recupero del file: ${res.status} ${res.statusText}` },
        { status: 400 }
      );
    }
    text = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch fallito";
    return NextResponse.json({ ok: false, error: `Impossibile scaricare l'URL: ${msg}` }, { status: 400 });
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

  const sourceLabel = url.replace(/^https?:\/\//, "").slice(0, 120);

  try {
    const { vehicleId, signalsAdded, dtcAdded } = await insertLibraryIntoDb(supabase, data, sourceLabel);

    try {
      await uploadLibToStorage(supabase, data.make, data.model, text);
    } catch (storageErr) {
      // DB già aggiornato; log e continua (diagnosi usa il DB)
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
