#!/usr/bin/env npx tsx
/**
 * Convert CSV (JejuSoul-style extended PIDs) to internal VehicleLibJson.
 * Reads from ../libs-sources/OBD-PIDs-for-HKMC-EVs/ (or path argument), writes to ../libs-sources/converted/
 * Usage: npx tsx convert-csv-to-json.ts [path-to-repo]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VehicleLibJson, SignalJson } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE = path.join(ROOT, "libs-sources", "OBD-PIDs-for-HKMC-EVs");
const OUT_DIR = path.join(ROOT, "libs-sources", "converted");

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || c === "\n" || c === "\r") {
      out.push(cur.trim());
      cur = "";
      if (c !== ",") break;
    } else {
      cur += c;
    }
  }
  if (cur.length) out.push(cur.trim());
  return out;
}

function csvToSignals(csvPath: string, make: string, model: string): VehicleLibJson {
  const text = fs.readFileSync(csvPath, "utf-8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const signals: SignalJson[] = [];
  const headers = lines[0]?.toLowerCase() ?? "";
  const nameIdx = headers.includes("parameter name") ? 0 : headers.includes("name") ? 0 : 0;
  const labelIdx = headers.includes("short label") ? 1 : 1;
  const pidIdx = headers.includes("pid") ? 2 : 2;
  const formulaIdx = headers.includes("formula") ? 3 : 3;
  const unitIdx = headers.includes("unit") ? 4 : 4;
  const ecuIdx = headers.includes("ecu") ? 5 : 5;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]!);
    if (cols.length < 3) continue;
    const name = (cols[nameIdx] ?? cols[0] ?? "").trim();
    const pid = (cols[pidIdx] ?? cols[2] ?? "").trim();
    if (!name && !pid) continue;
    signals.push({
      name: name || pid || `signal_${i}`,
      description: (cols[labelIdx] ?? cols[1] ?? "").trim() || undefined,
      did: pid?.startsWith("0x") ? pid : pid ? `0x${pid}` : undefined,
      formula: (cols[formulaIdx] ?? cols[3] ?? "").trim() || undefined,
      unit: (cols[unitIdx] ?? cols[4] ?? "").trim() || undefined,
      ecu_address: (cols[ecuIdx] ?? cols[5] ?? "").trim() || undefined,
      category: "general",
      source_file: path.basename(csvPath),
    });
  }

  return {
    make,
    model,
    signals,
    dtc: [],
  };
}

function findCsvFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...findCsvFilesRecursive(full));
    } else if (e.name.endsWith(".csv")) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const sourceDir = process.argv[2] ?? DEFAULT_SOURCE;
  if (!fs.existsSync(sourceDir)) {
    console.log("Source dir not found (run sync-libs first):", sourceDir);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const csvFiles = findCsvFilesRecursive(sourceDir);
  const byVehicle = new Map<string, string[]>();
  for (const f of csvFiles) {
    const rel = path.relative(sourceDir, f);
    const vehicle = path.dirname(rel).split(path.sep)[0] ?? "default";
    if (!byVehicle.has(vehicle)) byVehicle.set(vehicle, []);
    byVehicle.get(vehicle)!.push(f);
  }

  for (const [vehicleName, files] of byVehicle) {
    const firstWord = vehicleName.split(" ")[0];
    const make = firstWord ?? "Unknown";
    const model = vehicleName;
    let combined: VehicleLibJson = { make, model, signals: [], dtc: [] };
    for (const csvPath of files) {
      const lib = csvToSignals(csvPath, combined.make, combined.model);
      combined.signals.push(...lib.signals);
    }
    const safeName = vehicleName.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60);
    const outPath = path.join(OUT_DIR, `${safeName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(combined, null, 2), "utf-8");
    console.log("Wrote", outPath, "(", combined.signals.length, "signals)");
  }

  if (csvFiles.length === 0) {
    console.log("No CSV found. Run sync-libs first to populate libs-sources.");
  }

  console.log("Done. Output under libs-sources/converted/");
}

main();
