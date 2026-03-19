#!/usr/bin/env npx tsx
/**
 * Copia librerie da libs-sources/converted in Supabase: Database (vehicles, signals, dtc) + Storage (bucket libs).
 * Così tutto funziona su Vercel senza dipendenze locali.
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_*).
 * Usage: npx tsx import-to-supabase.ts [path-to-converted-dir]
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VehicleLibJson, SignalJson, DtcJson } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CONVERTED = path.join(ROOT, "libs-sources", "converted");

const LIBS_BUCKET = "libs";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_*) in env");
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

function slugForLib(make: string, model: string): string {
  const slug = `${make}_${model}`
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 120);
  return slug || "lib";
}

async function ensureLibsBucket(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.storage.createBucket(LIBS_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
  });
  const msg = error?.message ?? "";
  if (error && !/already exists|duplicate|Bucket.*exist/i.test(msg)) {
    throw error;
  }
}

async function uploadLibToStorage(
  supabase: SupabaseClient,
  make: string,
  model: string,
  jsonString: string
): Promise<string> {
  await ensureLibsBucket(supabase);
  const slug = slugForLib(make, model);
  const filePath = `${slug}.json`;
  const { error } = await supabase.storage.from(LIBS_BUCKET).upload(filePath, jsonString, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw error;
  return filePath;
}

async function ensureVehicle(
  supabase: SupabaseClient,
  lib: VehicleLibJson,
  sourceFile: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("vehicles")
    .select("id")
    .eq("make", lib.make)
    .eq("model", lib.model)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("signals").delete().eq("vehicle_id", existing.id);
    await supabase.from("dtc").delete().eq("vehicle_id", existing.id);
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from("vehicles")
    .insert({
      make: lib.make,
      model: lib.model,
      year_from: lib.year_from ?? null,
      year_to: lib.year_to ?? null,
      can_ids: lib.can_ids ?? null,
      source_repo: sourceFile,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Vehicle insert error:", error.message);
    return null;
  }
  return inserted?.id ?? null;
}

async function insertSignals(
  supabase: SupabaseClient,
  vehicleId: string,
  signals: SignalJson[]
): Promise<number> {
  if (signals.length === 0) return 0;
  const rows = signals.map((s) => ({
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
  const { error } = await supabase.from("signals").insert(rows);
  if (error) {
    console.error("Signals insert error:", error.message);
    return 0;
  }
  return rows.length;
}

async function insertDtc(
  supabase: SupabaseClient,
  vehicleId: string,
  dtc: DtcJson[]
): Promise<number> {
  if (dtc.length === 0) return 0;
  const rows = dtc.map((d) => ({
    vehicle_id: vehicleId,
    code: d.code,
    description_it: d.description_it ?? null,
    description_en: d.description_en ?? null,
    severity: d.severity ?? null,
    system: d.system ?? null,
    possible_causes: d.possible_causes ?? null,
    source_file: d.source_file ?? null,
  }));
  const { error } = await supabase.from("dtc").insert(rows);
  if (error) {
    console.error("DTC insert error:", error.message);
    return 0;
  }
  return rows.length;
}

async function main() {
  const convertedDir = process.argv[2] ?? DEFAULT_CONVERTED;
  if (!fs.existsSync(convertedDir)) {
    console.log("Converted dir not found. Run convert-csv-to-json or convert-dbc-to-json first:", convertedDir);
    process.exit(1);
  }

  const supabase = getSupabase();
  const files = fs.readdirSync(convertedDir).filter((f) => f.endsWith(".json"));
  let vehiclesDone = 0;
  let signalsDone = 0;
  let dtcDone = 0;

  let storageDone = 0;
  for (const file of files) {
    const filePath = path.join(convertedDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    let lib: VehicleLibJson;
    try {
      lib = JSON.parse(raw) as VehicleLibJson;
    } catch {
      console.error("Invalid JSON:", file);
      continue;
    }
    if (!lib.make || !lib.model) {
      console.error("Missing make/model:", file);
      continue;
    }
    const vehicleId = await ensureVehicle(supabase, lib, file);
    if (!vehicleId) continue;
    vehiclesDone++;
    const s = await insertSignals(supabase, vehicleId, lib.signals ?? []);
    const d = await insertDtc(supabase, vehicleId, lib.dtc ?? []);
    signalsDone += s;
    dtcDone += d;
    try {
      await uploadLibToStorage(supabase, lib.make, lib.model, raw);
      storageDone++;
    } catch (err) {
      console.warn("Storage upload failed for", file, err);
    }
    console.log(file, "-> DB + Storage |", s, "signals,", d, "dtc");
  }

  console.log("Done. Vehicles:", vehiclesDone, "Signals:", signalsDone, "DTC:", dtcDone, "| Storage files:", storageDone);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
