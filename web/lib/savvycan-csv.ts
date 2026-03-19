/**
 * SavvyCAN Native CSV format (GVRET-compatible) parser and exporter.
 * Format: Time Stamp,ID,Extended,Dir,Bus,LEN,D1,D2,D3,D4,D5,D6,D7,D8
 * Same format used by ESP32_RET_SD and SavvyCAN desktop. See libs-sources/SavvyCAN/framefileio.cpp.
 */

export interface CanFrameForCsv {
  id: number;
  len: number;
  data: number[];
  /** Timestamp in microseconds (for export). If missing, relative timestamps are used. */
  tsMicros?: number;
}

const NATIVE_CSV_HEADER =
  "Time Stamp,ID,Extended,Dir,Bus,LEN,D1,D2,D3,D4,D5,D6,D7,D8";

/**
 * Detect SavvyCAN Native CSV v2 (has "Dir" column). Header line must be provided.
 */
function isV2Format(headerLine: string): boolean {
  const upper = headerLine.toUpperCase();
  return upper.includes("DIR");
}

/**
 * Parse a SavvyCAN Native CSV file content into CAN frames.
 * Supports v1 (no Dir) and v2 (with Dir) formats.
 * Returns array of frames; invalid lines are skipped.
 */
export function parseSavvyCanNativeCsv(csvContent: string): CanFrameForCsv[] {
  const lines = csvContent.split(/\r?\n/).map((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0] ?? "";
  const v2 = isV2Format(header);
  const frames: CanFrameForCsv[] = [];
  let timeStamp = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length < 2) continue;

    const tokens = line.split(",").map((t) => t.trim());
    if (v2) {
      // v2: Time Stamp,ID,Extended,Dir,Bus,LEN,D1..D8
      if (tokens.length < 6) continue;
      const tsRaw = tokens[0];
      const ts =
        tsRaw.length > 3
          ? parseInt(tsRaw, 10) || (tsRaw ? Number(tsRaw) : 0)
          : (timeStamp += 5000);
      if (ts > 0) timeStamp = ts;

      const id = parseInt(tokens[1], 16) || 0;
      const extended = (tokens[2] ?? "").toUpperCase().includes("TRUE");
      const bus = parseInt(tokens[4], 10) || 0;
      let len = parseInt(tokens[5], 10) || 0;
      if (len > 8) len = 8;
      if (len < 0) len = 0;
      const dataStart = 6;
      if (len + dataStart > tokens.length) len = Math.max(0, tokens.length - dataStart);

      const data: number[] = [];
      for (let d = 0; d < len; d++) {
        const byte = parseInt(tokens[dataStart + d], 16);
        data.push(Number.isNaN(byte) ? 0 : byte & 0xff);
      }

      frames.push({
        id: extended && id <= 0x7ff ? id : id,
        len: data.length,
        data,
        tsMicros: ts,
      });
    } else {
      // v1: Time Stamp,ID,Extended,Bus,LEN,D1..D8 (no Dir)
      if (tokens.length < 5) continue;
      const tsRaw = tokens[0];
      const ts =
        tsRaw.length > 3
          ? parseInt(tsRaw, 10) || (tsRaw ? Number(tsRaw) : 0)
          : (timeStamp += 5000);
      if (ts > 0) timeStamp = ts;

      const id = parseInt(tokens[1], 16) || 0;
      let len = parseInt(tokens[4], 10) || 0;
      if (len > 8) len = 8;
      if (len < 0) len = 0;
      const dataStart = 5;
      if (len + dataStart > tokens.length) len = Math.max(0, tokens.length - dataStart);

      const data: number[] = [];
      for (let d = 0; d < len; d++) {
        const byte = parseInt(tokens[dataStart + d], 16);
        data.push(Number.isNaN(byte) ? 0 : byte & 0xff);
      }

      frames.push({
        id,
        len: data.length,
        data,
        tsMicros: ts,
      });
    }
  }

  return frames;
}

/**
 * Export CAN frames to SavvyCAN Native CSV string (v2 format with Dir).
 * Frames can have tsMicros; if not present, relative timestamps (5 ms step) are used.
 */
export function exportToSavvyCanNativeCsv(frames: CanFrameForCsv[]): string {
  const lines: string[] = [NATIVE_CSV_HEADER];
  let ts = 0;

  for (const f of frames) {
    const micros = f.tsMicros ?? (ts += 5000);
    const idStr = f.id.toString(16).toUpperCase();
    const extended = f.id > 0x7ff ? "true" : "false";
    const data = (f.data ?? []).slice(0, 8);
    const dataHex = Array.from({ length: 8 }, (_, i) =>
      (data[i] ?? 0).toString(16).toUpperCase().padStart(2, "0")
    ).join(",");
    const len = data.length;
    lines.push(`${micros},${idStr},${extended},Rx,0,${len},${dataHex}`);
  }

  return lines.join("\n");
}
