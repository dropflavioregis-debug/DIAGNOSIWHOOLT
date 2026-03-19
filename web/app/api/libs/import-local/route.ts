import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Same shape as import route — make, model, signals, dtc. */
interface VehicleLibPayload {
  make: string;
  model: string;
  year_from?: number;
  year_to?: number;
  can_ids?: string[];
  signals: Array<{
    name: string;
    description?: string;
    did?: string;
    ecu_address?: string;
    formula?: string;
    unit?: string;
    min_value?: number;
    max_value?: number;
    category?: string;
    source_file?: string;
  }>;
  dtc: Array<{
    code: string;
    description_it?: string;
    description_en?: string;
    severity?: string;
    system?: string;
    possible_causes?: string[] | null;
    source_file?: string;
  }>;
}

function isVehicleLibPayload(obj: unknown): obj is VehicleLibPayload {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.make === "string" &&
    o.make.length > 0 &&
    typeof o.model === "string" &&
    o.model.length > 0 &&
    Array.isArray(o.signals) &&
    Array.isArray(o.dtc)
  );
}

export async function POST() {
  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Import da filesystem locale non disponibile su Vercel. Usa Import da URL o upload file dalla pagina Libs.",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database non configurato" }, { status: 503 });
  }

  const cwd = process.cwd();
  const convertedDir =
    fs.existsSync(path.join(cwd, "libs-sources", "converted"))
      ? path.join(cwd, "libs-sources", "converted")
      : path.join(cwd, "..", "libs-sources", "converted");
  if (!fs.existsSync(convertedDir)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Cartella libs-sources/converted non trovata. Avvia l'app da DIAGNOSIWHOOLT/web (o dalla root) e assicurati di aver eseguito sync + convert (scripts/sync-libs.ts e convert-csv-to-json.ts).",
      },
      { status: 404 }
    );
  }

  const files = fs.readdirSync(convertedDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nessun file .json in libs-sources/converted. Esegui gli script di conversione." },
      { status: 404 }
    );
  }

  const results: { file: string; make: string; model: string; signals: number; dtc: number }[] = [];
  let vehiclesDone = 0;
  let signalsDone = 0;
  let dtcDone = 0;

  for (const file of files) {
    const filePath = path.join(convertedDir, file);
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!isVehicleLibPayload(data)) continue;

    const sourceLabel = `libs-sources/converted/${file}`;

    const { data: existing } = await supabase
      .from("vehicles")
      .select("id")
      .eq("make", data.make)
      .eq("model", data.model)
      .limit(1)
      .maybeSingle();

    let vehicleId: string;
    if (existing?.id) {
      vehicleId = existing.id;
      await supabase.from("signals").delete().eq("vehicle_id", vehicleId);
      await supabase.from("dtc").delete().eq("vehicle_id", vehicleId);
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("vehicles")
        .insert({
          make: data.make,
          model: data.model,
          year_from: data.year_from ?? null,
          year_to: data.year_to ?? null,
          can_ids: data.can_ids ?? null,
          source_repo: sourceLabel,
        })
        .select("id")
        .single();

      if (insertErr || !inserted?.id) continue;
      vehicleId = inserted.id;
    }
    vehiclesDone++;

    const signalsToInsert = (data.signals ?? []).map((s) => ({
      vehicle_id: vehicleId,
      name: s.name,
      description: s.description ?? null,
      did: s.did ?? null,
      ecu_address: s.ecu_address ?? null,
      formula: s.formula ?? null,
      unit: s.unit ?? null,
      min_value: s.min_value ?? null,
      max_value: s.max_value ?? null,
      category: s.category ?? "general",
      source_file: s.source_file ?? null,
    }));
    if (signalsToInsert.length > 0) {
      await supabase.from("signals").insert(signalsToInsert);
      signalsDone += signalsToInsert.length;
    }

    const dtcToInsert = (data.dtc ?? []).map((d) => ({
      vehicle_id: vehicleId,
      code: d.code,
      description_it: d.description_it ?? null,
      description_en: d.description_en ?? null,
      severity: d.severity ?? null,
      system: d.system ?? null,
      possible_causes: Array.isArray(d.possible_causes) ? d.possible_causes : null,
      source_file: d.source_file ?? null,
    }));
    if (dtcToInsert.length > 0) {
      await supabase.from("dtc").insert(dtcToInsert);
      dtcDone += dtcToInsert.length;
    }

    results.push({
      file,
      make: data.make,
      model: data.model,
      signals: signalsToInsert.length,
      dtc: dtcToInsert.length,
    });
  }

  return NextResponse.json({
    ok: true,
    imported: results.length,
    vehiclesDone,
    signalsDone,
    dtcDone,
    results,
  });
}
