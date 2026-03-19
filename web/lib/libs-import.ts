import type { SupabaseClient } from "@supabase/supabase-js";

export const LIBS_BUCKET = "libs";

/** Payload JSON libreria (make, model, signals, dtc). */
export interface VehicleLibPayload {
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

export function isVehicleLibPayload(obj: unknown): obj is VehicleLibPayload {
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

/** Slug per path in Storage: make_model senza caratteri speciali. */
export function slugForLib(make: string, model: string): string {
  const slug = `${make}_${model}`
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 120);
  return slug || "lib";
}

/** Crea il bucket libs se non esiste (ignora errore se già presente). */
export async function ensureLibsBucket(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.storage.createBucket(LIBS_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB
  });
  const msg = error?.message ?? "";
  if (error && !/already exists|duplicate|Bucket.*exist/i.test(msg)) {
    throw error;
  }
}

/** Salva il JSON della libreria in Storage. Path: {slug}.json */
export async function uploadLibToStorage(
  supabase: SupabaseClient,
  make: string,
  model: string,
  jsonString: string
): Promise<string> {
  await ensureLibsBucket(supabase);
  const slug = slugForLib(make, model);
  const path = `${slug}.json`;
  const { error } = await supabase.storage.from(LIBS_BUCKET).upload(path, jsonString, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

/** Inserisce/aggiorna veicolo + segnali + DTC nel DB. Ritorna vehicleId e conteggi. */
export async function insertLibraryIntoDb(
  supabase: SupabaseClient,
  data: VehicleLibPayload,
  sourceLabel: string
): Promise<{ vehicleId: string; signalsAdded: number; dtcAdded: number }> {
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

    if (insertErr || !inserted?.id) {
      throw new Error(insertErr?.message ?? "Errore creazione veicolo");
    }
    vehicleId = inserted.id;
  }

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

  let signalsAdded = 0;
  if (signalsToInsert.length > 0) {
    const { error: sigErr } = await supabase.from("signals").insert(signalsToInsert);
    if (!sigErr) signalsAdded = signalsToInsert.length;
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

  let dtcAdded = 0;
  if (dtcToInsert.length > 0) {
    const { error: dtcErr } = await supabase.from("dtc").insert(dtcToInsert);
    if (!dtcErr) dtcAdded = dtcToInsert.length;
  }

  return { vehicleId, signalsAdded, dtcAdded };
}
