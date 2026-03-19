import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { queueSnifferStateCommand } from "@/lib/device-sniffer-state";

export const dynamic = "force-dynamic";

function checkApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("x-api-key");
  const envKey = process.env.API_KEY;
  if (!envKey || envKey.length === 0) return true;
  return apiKey === envKey;
}

/** Dashboard: attiva sniffer per device (device riceverà sniffer_active: true al prossimo poll GET /api/device/commands). */
export async function POST(request: NextRequest) {
  if (!checkApiKey(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { device_id?: string };
    const deviceId = typeof body?.device_id === "string" ? body.device_id.trim() : "";
    if (!deviceId) {
      return NextResponse.json(
        { ok: false, error: "device_id is required" },
        { status: 400 }
      );
    }
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });
    }
    const result = await queueSnifferStateCommand(supabase, deviceId, true);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? "Failed to queue command" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, message: "Sniffer subscribed", device_id: deviceId });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
}

/** Dashboard: disattiva sniffer per device. */
export async function DELETE(request: NextRequest) {
  if (!checkApiKey(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("device_id")?.trim() ?? "";
  if (!deviceId) {
    return NextResponse.json(
      { ok: false, error: "device_id query param is required" },
      { status: 400 }
    );
  }
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const result = await queueSnifferStateCommand(supabase, deviceId, false);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Failed to queue command" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: "Sniffer unsubscribed", device_id: deviceId });
}
