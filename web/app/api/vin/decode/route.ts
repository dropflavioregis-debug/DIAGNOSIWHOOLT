import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VIN_LENGTH = 17;

function isValidVinLength(vin: string): boolean {
  return typeof vin === "string" && vin.trim().length === VIN_LENGTH;
}

export async function GET(request: NextRequest) {
  const vin = request.nextUrl.searchParams.get("vin");
  if (!vin || !isValidVinLength(vin)) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid vin (must be 17 characters)" },
      { status: 400 }
    );
  }
  const { decodeVinFull } = await import("@/lib/vin-decode");
  const result = await decodeVinFull(vin);
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Decode failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, result });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const vin = typeof body?.vin === "string" ? body.vin : null;
    if (!vin || !isValidVinLength(vin)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid vin (must be 17 characters)" },
        { status: 400 }
      );
    }
    const { decodeVinFull } = await import("@/lib/vin-decode");
    const result = await decodeVinFull(vin);
    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Decode failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
}
