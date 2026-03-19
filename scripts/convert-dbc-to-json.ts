#!/usr/bin/env npx tsx
/**
 * Convert DBC files to internal VehicleLibJson (minimal parser).
 * Reads from ../libs-sources/ (or path argument), writes to ../libs-sources/converted/
 * Usage: npx tsx convert-dbc-to-json.ts [path-to-repo-or-dir]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VehicleLibJson, SignalJson } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SOURCE = path.join(ROOT, "libs-sources");
const OUT_DIR = path.join(ROOT, "libs-sources", "converted");

function findDbcFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...findDbcFiles(full));
    } else if (e.name.endsWith(".dbc")) {
      out.push(full);
    }
  }
  return out;
}

interface DbcMessage {
  id: number;
  name: string;
  signals: { name: string; startBit?: number; length?: number; unit?: string; factor?: number; offset?: number }[];
}

function parseDbc(content: string): DbcMessage[] {
  const messages: DbcMessage[] = [];
  const lines = content.split(/\r?\n/);
  let current: DbcMessage | null = null;

  for (const line of lines) {
    const t = line.trim();
    const boMatch = t.match(/^BO_\s+(\d+)\s+(\w+)/);
    if (boMatch) {
      if (current) messages.push(current);
      current = { id: parseInt(boMatch[1]!, 10), name: boMatch[2]!, signals: [] };
      continue;
    }
    const sgMatch = t.match(/^SG_\s+(\w+)\s*:/);
    if (sgMatch && current) {
      const rest = t.slice(sgMatch[0].length);
      const unitMatch = rest.match(/\s*"([^"]*)"\s*$/);
      current.signals.push({
        name: sgMatch[1]!,
        unit: unitMatch ? unitMatch[1]!.trim() || undefined : undefined,
      });
    }
  }
  if (current) messages.push(current);
  return messages;
}

function dbcToVehicleLib(dbcPath: string, make: string, model: string): VehicleLibJson {
  const content = fs.readFileSync(dbcPath, "utf-8");
  const messages = parseDbc(content);
  const signals: SignalJson[] = [];
  for (const msg of messages) {
    for (const sg of msg.signals) {
      signals.push({
        name: sg.name,
        did: `0x${msg.id.toString(16).toUpperCase()}`,
        ecu_address: undefined,
        formula: sg.factor != null ? `A*${sg.factor}+${sg.offset ?? 0}` : undefined,
        unit: sg.unit,
        category: "general",
        source_file: path.basename(dbcPath),
      });
    }
  }
  return { make, model, signals, dtc: [] };
}

function main() {
  const sourceDir = process.argv[2] ?? DEFAULT_SOURCE;
  if (!fs.existsSync(sourceDir)) {
    console.log("Source dir not found:", sourceDir);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dbcFiles = findDbcFiles(sourceDir);
  const byDir = new Map<string, string[]>();
  for (const f of dbcFiles) {
    const dir = path.dirname(f);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(f);
  }

  for (const [dir, files] of byDir) {
    const dirName = path.basename(dir);
    const make = "Unknown";
    const model = dirName.replace(/[^a-zA-Z0-9\s-]/g, " ").trim() || "Vehicle";
    let combined: VehicleLibJson = { make, model, signals: [], dtc: [] };
    for (const dbcPath of files) {
      const lib = dbcToVehicleLib(dbcPath, make, model);
      combined.signals.push(...lib.signals);
    }
    const safeName = (model || "dbc_export").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60);
    const outPath = path.join(OUT_DIR, `${safeName}.json`);
    fs.writeFileSync(outPath, JSON.stringify(combined, null, 2), "utf-8");
    console.log("Wrote", outPath, "(", combined.signals.length, "signals)");
  }

  if (dbcFiles.length === 0) {
    console.log("No .dbc files found under", sourceDir);
  }
  console.log("Done. Output under libs-sources/converted/");
}

main();
