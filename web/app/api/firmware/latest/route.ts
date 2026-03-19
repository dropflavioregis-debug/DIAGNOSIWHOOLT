import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FIRMWARE_VERSION = process.env.FIRMWARE_VERSION ?? "1.0.0";
const FIRMWARE_BINARY_URL = process.env.FIRMWARE_BINARY_URL ?? "";

export async function GET() {
  return NextResponse.json({
    version: FIRMWARE_VERSION,
    url: FIRMWARE_BINARY_URL,
    build: process.env.FIRMWARE_BUILD ?? undefined,
  });
}
