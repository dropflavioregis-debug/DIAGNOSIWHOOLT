#!/usr/bin/env npx tsx
/**
 * Extract OVMS3 vehicle index: list vehicle_* components (and plugin v-*) and emit
 * VehicleLibJson per vehicle (signals/dtc empty). For use after cloning OVMS3 via sync-libs.
 * Reads from ../libs-sources/Open-Vehicle-Monitoring-System-3 (or path argument).
 * Usage: npx tsx convert-ovms-vehicles.ts [path-to-OVMS3-repo]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VehicleLibJson } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OVMS3 = path.join(ROOT, "libs-sources", "Open-Vehicle-Monitoring-System-3");
const OUT_DIR = path.join(ROOT, "libs-sources", "converted");

/** OVMS component id -> [make, model]. Skip entries with null. */
const OVMS_MAKE_MODEL: Record<string, [string, string] | null> = {
  vehicle_bmwi3: ["BMW", "i3"],
  vehicle_boltev: ["Chevrolet", "Bolt EV"],
  vehicle_byd_atto3: ["BYD", "Atto 3"],
  vehicle_cadillac_c2_cts: ["Cadillac", "CTS (C2)"],
  vehicle_chevrolet_c6_corvette: ["Chevrolet", "Corvette C6"],
  vehicle_dbc: ["Generic", "DBC"],
  vehicle_demo: ["OVMS", "Demo"],
  vehicle_energica: ["Energica", "Energica"],
  vehicle_fiat500: ["Fiat", "500e"],
  vehicle_fiatedoblo: ["Fiat", "e-Doblo"],
  vehicle_hyundai_ioniq5: ["Hyundai", "Ioniq 5"],
  vehicle_hyundai_ioniqvfl: ["Hyundai", "Ioniq vFL"],
  vehicle_jaguaripace: ["Jaguar", "I-Pace"],
  vehicle_kianiroev: ["Kia", "e-Niro"],
  vehicle_kiasoulev: ["Kia", "Soul EV"],
  vehicle_maple60s: ["Livan", "Maple 60s"],
  vehicle_maxus_edeliver3: ["Maxus", "eDeliver 3"],
  vehicle_maxus_euniq56: ["Maxus", "Euniq 5/6"],
  vehicle_maxus_euniq6: ["Maxus", "Euniq 6"],
  vehicle_maxus_t90: ["Maxus", "T90 EV"],
  vehicle_mercedesb250e: ["Mercedes-Benz", "B250e"],
  vehicle_mgev: ["MG", "MG EV"],
  vehicle_minise: ["Mini", "Cooper SE"],
  vehicle_mitsubishi: ["Mitsubishi", "i-MiEV"],
  vehicle_nissanleaf: ["Nissan", "Leaf"],
  vehicle_niu_gtevo: ["NIU", "MQi GT EVO"],
  vehicle_none: null,
  vehicle_obdii: ["Generic", "OBD-II"],
  vehicle_renaulttwizy: ["Renault", "Twizy"],
  vehicle_renaultzoe: ["Renault", "Zoe"],
  vehicle_renaultzoe_ph2: ["Renault", "Zoe Phase 2"],
  vehicle_smarted: ["Smart", "ED Gen.3"],
  vehicle_smarteq: ["Smart", "EQ Gen.4 (453)"],
  vehicle_teslamodel3: ["Tesla", "Model 3"],
  vehicle_teslamodels: ["Tesla", "Model S"],
  vehicle_teslaroadster: ["Tesla", "Roadster"],
  vehicle_thinkcity: ["Think", "City"],
  vehicle_toyotarav4ev: ["Toyota", "RAV4 EV"],
  vehicle_track: null,
  vehicle_voltampera: ["Chevrolet", "Volt / Ampera"],
  vehicle_vwegolf: ["VW", "e-Golf"],
  vehicle_vweup: ["VW", "e-Up"],
  vehicle_zeva: ["Zeva", "BMS"],
  vehicle_zombie_vcu: ["ZombieVerter", "VCU"],
};

/** Plugin id -> [make, model] */
const PLUGIN_MAKE_MODEL: Record<string, [string, string]> = {
  "v-twizy": ["Renault", "Twizy (plugin)"],
  "v-vweup": ["VW", "e-Up (plugin)"],
};

function slugSafe(name: string): string {
  return name
    .replace(/^vehicle_/, "ovms_")
    .replace(/^v-/, "ovms_plugin_")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 80);
}

function findVehicleComponents(componentsDir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(componentsDir)) return out;
  const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && e.name.startsWith("vehicle_")) {
      out.push(e.name);
    }
  }
  return out.sort();
}

function findPluginVehicles(pluginDir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(pluginDir)) return out;
  const entries = fs.readdirSync(pluginDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && e.name.startsWith("v-")) {
      out.push(e.name);
    }
  }
  return out.sort();
}

function main() {
  const repoRoot = process.argv[2] ?? DEFAULT_OVMS3;
  if (!fs.existsSync(repoRoot)) {
    console.log("OVMS3 repo not found. Run sync-libs.ts first:", repoRoot);
    process.exit(1);
  }

  const componentsDir = path.join(repoRoot, "vehicle", "OVMS.V3", "components");
  const pluginDir = path.join(repoRoot, "plugin");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const written: string[] = [];
  const skipped: string[] = [];

  for (const compId of findVehicleComponents(componentsDir)) {
    let makeModel = OVMS_MAKE_MODEL[compId];
    if (makeModel === null) {
      skipped.push(compId);
      continue;
    }
    if (!makeModel) {
      const derived = compId.replace(/^vehicle_/, "").replace(/_/g, " ");
      const model = derived.replace(/\b\w/g, (c) => c.toUpperCase());
      makeModel = ["OVMS", model];
    }
    const [make, model] = makeModel;
    const lib: VehicleLibJson & { source?: string; ovms_component?: string } = {
      make,
      model,
      signals: [],
      dtc: [],
      source: "ovms3",
      ovms_component: compId,
    };
    const slug = slugSafe(compId);
    const outPath = path.join(OUT_DIR, `${slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(lib, null, 2), "utf-8");
    written.push(`${slug}.json (${make} ${model})`);
  }

  for (const pluginId of findPluginVehicles(pluginDir)) {
    const makeModel = PLUGIN_MAKE_MODEL[pluginId];
    if (!makeModel) {
      skipped.push(`plugin:${pluginId}`);
      continue;
    }
    const [make, model] = makeModel;
    const lib: VehicleLibJson & { source?: string; ovms_component?: string } = {
      make,
      model,
      signals: [],
      dtc: [],
      source: "ovms3",
      ovms_component: `plugin/${pluginId}`,
    };
    const slug = slugSafe(pluginId);
    const outPath = path.join(OUT_DIR, `${slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(lib, null, 2), "utf-8");
    written.push(`${slug}.json (${make} ${model})`);
  }

  for (const w of written) {
    console.log("Wrote", w);
  }
  if (skipped.length) {
    console.log("Skipped (no mapping or excluded):", skipped.join(", "));
  }
  console.log("Done. Output under libs-sources/converted/. Run import-to-supabase.ts to push to DB.");
}

main();
