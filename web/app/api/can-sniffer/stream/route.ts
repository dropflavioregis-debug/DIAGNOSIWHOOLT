import { NextRequest, NextResponse } from "next/server";
import { appendFrames, getFrames } from "@/lib/can-sniffer-frames-store";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX_FRAMES_PERSIST_PER_REQUEST = 500;

function checkApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("x-api-key");
  const envKey = process.env.API_KEY;
  if (!envKey || envKey.length === 0) return true;
  return apiKey === envKey;
}

/** ESP32: invia batch di frame CAN. Body: { device_id, session_id?, frames: [{ id, len, data?, extended? }] }. */
export async function POST(request: NextRequest) {
  if (!checkApiKey(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      device_id?: string;
      session_id?: string;
      frames?: Array<{ id: number; len: number; data?: number[]; extended?: boolean }>;
    };
    const deviceId = typeof body?.device_id === "string" ? body.device_id.trim() : "";
    const sessionId = typeof body?.session_id === "string" ? body.session_id.trim() || null : null;
    const frames = Array.isArray(body?.frames) ? body.frames : [];
    if (!deviceId) {
      return NextResponse.json(
        { ok: false, error: "device_id is required" },
        { status: 400 }
      );
    }
    if (frames.length === 0) {
      return NextResponse.json({ ok: true, received: 0, persisted: 0 });
    }
    const normalized = frames.map((f) => ({
      id: Number(f.id),
      len: Number(f.len),
      data: Array.isArray(f.data) ? f.data.slice(0, 8).map(Number) : [],
    }));
    appendFrames(deviceId, normalized);

    let persisted = 0;
    const supabase = getSupabase();
    if (supabase) {
      const toPersist = normalized.slice(0, MAX_FRAMES_PERSIST_PER_REQUEST);
      const rows = toPersist.map((f, i) => {
        const raw = frames[i];
        const extended = typeof raw?.extended === "boolean" ? raw.extended : false;
        const dataBytes = Buffer.from(
          (Array.isArray(f.data) ? f.data : []).map((b) => Math.max(0, Math.min(255, Number(b))))
        );
        return {
          device_id: deviceId,
          session_id: sessionId || null,
          can_id: f.id,
          extended,
          len: Math.min(8, Math.max(0, f.len)),
          data_hex: dataBytes.length ? dataBytes.toString("hex") : "",
        };
      });
      const { error } = await supabase.from("can_frames").insert(rows);
      if (!error) persisted = rows.length;
    }

    return NextResponse.json({
      ok: true,
      received: normalized.length,
      persisted,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
}

/** Dashboard: ultimi N frame per device_id. Query: device_id, limit (opzionale). */
export async function GET(request: NextRequest) {
  if (!checkApiKey(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("device_id")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "500", 10) || 500, 2000);
  if (!deviceId) {
    return NextResponse.json(
      { ok: false, error: "device_id query param is required" },
      { status: 400 }
    );
  }
  const frames = getFrames(deviceId, limit);
  return NextResponse.json({ ok: true, frames });
}
