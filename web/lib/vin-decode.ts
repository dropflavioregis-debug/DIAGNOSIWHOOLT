import VINDecoder, { type DecodeResult } from "@cardog/corgi/browser";

const VIN_LENGTH = 17;
const CORGI_DB_URL = "https://corgi.cardog.io/vpic.lite.db.gz";

/** Sanitized VIN decode result for storage (sessions.vin_decoded) */
export interface VinDecodedPayload {
  make?: string;
  model?: string;
  year?: number;
  series?: string;
  body_style?: string;
  drive_type?: string;
  fuel_type?: string;
  doors?: string;
  valid: boolean;
}

let decoderInstance: VINDecoder | null = null;

function getDecoder(): VINDecoder {
  if (decoderInstance) return decoderInstance;
  const databasePath = process.env.VIN_DECODER_DATABASE_URL || CORGI_DB_URL;
  decoderInstance = new VINDecoder({ databasePath });
  return decoderInstance;
}

/**
 * Decode a 17-character VIN using Corgi (NHTSA VPIC).
 * Uses browser runtime + CDN DB so no native better-sqlite3 is required (Vercel-safe).
 * Returns a payload suitable for sessions.vin_decoded or null on error.
 */
export async function decodeVin(vin: string): Promise<VinDecodedPayload | null> {
  const trimmed = typeof vin === "string" ? vin.trim().toUpperCase() : "";
  if (trimmed.length !== VIN_LENGTH) return null;

  try {
    const decoder = getDecoder();
    const result: DecodeResult = await decoder.decode(trimmed);
    const vehicle = result.components?.vehicle;
    return {
      make: vehicle?.make,
      model: vehicle?.model,
      year: vehicle?.year,
      series: vehicle?.series,
      body_style: vehicle?.bodyStyle,
      drive_type: vehicle?.driveType,
      fuel_type: vehicle?.fuelType,
      doors: vehicle?.doors,
      valid: result.valid === true,
    };
  } catch {
    return null;
  }
}

const NHTSA_DECODE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

/** Decode VIN via NHTSA API (works in Node / serverless when Corgi browser adapter fails). */
async function decodeVinNhtsa(vin: string): Promise<DecodeResult | null> {
  const trimmed = vin.trim().toUpperCase();
  try {
    const res = await fetch(
      `${NHTSA_DECODE_URL}/${encodeURIComponent(trimmed)}?format=json`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      Results?: Array<{
        Make?: string;
        Model?: string;
        Manufacturer?: string;
        ModelYear?: string;
        VehicleType?: string;
      }>;
    };
    const r = data.Results?.[0];
    if (!r) return null;
    const make = (r.Make || r.Manufacturer || "").trim() || undefined;
    const model = (r.Model || "").trim() || undefined;
    const yearStr = (r.ModelYear || "").trim();
    const year = yearStr ? parseInt(yearStr, 10) : NaN;
    return {
      vin: trimmed,
      valid: true,
      errors: [],
      components: {
        vehicle: {
          make,
          model,
          year: Number.isFinite(year) ? year : undefined,
          vehicleType: r.VehicleType,
        },
      },
    } as DecodeResult;
  } catch {
    return null;
  }
}

/**
 * Full DecodeResult for API responses (e.g. GET /api/vin/decode).
 * Tries Corgi first; on failure (e.g. in Node where browser adapter fails) falls back to NHTSA API.
 */
export async function decodeVinFull(vin: string): Promise<DecodeResult | null> {
  const trimmed = typeof vin === "string" ? vin.trim().toUpperCase() : "";
  if (trimmed.length !== VIN_LENGTH) return null;

  try {
    const decoder = getDecoder();
    const result = await decoder.decode(trimmed);
    if (result) return result;
  } catch {
    /* Corgi browser adapter often fails in Node; fall through to NHTSA */
  }
  return decodeVinNhtsa(trimmed);
}

export function isValidVinLength(vin: string): boolean {
  return typeof vin === "string" && vin.trim().length === VIN_LENGTH;
}
