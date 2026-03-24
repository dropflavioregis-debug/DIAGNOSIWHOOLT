import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSnifferActiveState } from "@/lib/device-sniffer-state";
import { auditRuntime, logDeviceUpdateEvent } from "@/lib/control-plane";

export const dynamic = "force-dynamic";

/** Lista device_id univoci dalle sessioni (per popolare il dropdown in webapp). */
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ devices: [], message: "Supabase not configured" });
  }

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("device_id");

  // Polling dal dispositivo: ?device_id=EV-Diag-01 → ritorna comandi in sospeso e li marca come letti
  if (deviceId && deviceId.trim() !== "") {
    const apiKey = request.headers.get("x-api-key");
    const envKey = process.env.API_KEY;
    if (envKey && envKey.length > 0 && apiKey !== envKey) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: rows, error } = await supabase
      .from("device_commands")
      .select("id, command, payload")
      .eq("device_id", deviceId.trim())
      .is("acknowledged_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const commands = (rows ?? []).map((r) => ({
      id: r.id,
      command: r.command,
      schema_version: (r.payload as { schema_version?: number } | null)?.schema_version ?? 1,
      ttl_ms: (r.payload as { ttl_ms?: number } | null)?.ttl_ms ?? 60_000,
      payload: r.payload ?? undefined,
    }));

    if (commands.length > 0) {
      await supabase
        .from("device_commands")
        .update({ acknowledged_at: new Date().toISOString() })
        .in("id", commands.map((c) => c.id));
      await auditRuntime(deviceId.trim(), "firmware", "commands_acknowledged", {
        count: commands.length,
        command_ids: commands.map((c) => c.id),
      });
      for (const cmd of commands) {
        await logDeviceUpdateEvent(deviceId.trim(), "command_ack", "ok", null, {
          command: cmd.command,
        });
      }
    }

    const sniffer_active = await getSnifferActiveState(supabase, deviceId.trim());
    return NextResponse.json({ ok: true, commands, sniffer_active });
  }

  // Lista dispositivi (per webapp): device_id univoci dalle sessioni
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("device_id")
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const devices: string[] = [];
  for (const s of sessions ?? []) {
    const id = s.device_id?.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      devices.push(id);
    }
  }

  return NextResponse.json({ devices });
}

/** Crea un comando per un dispositivo (chiamata dalla webapp). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { device_id?: string; command?: string; payload?: unknown };
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid body: expected JSON object" },
        { status: 400 }
      );
    }

    const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
    const command = typeof body.command === "string" ? body.command.trim() : "";
    if (!deviceId || !command) {
      return NextResponse.json(
        { ok: false, error: "device_id and command are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });
    }

    const { data, error } = await supabase
      .from("device_commands")
      .insert({
        device_id: deviceId,
        command,
        payload: {
          schema_version: 1,
          ttl_ms: 60_000,
          ...(body.payload && typeof body.payload === "object" ? (body.payload as Record<string, unknown>) : {}),
        },
      })
      .select("id, command, created_at")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await auditRuntime(deviceId, "api", "queue_command", {
      command,
      payload: body.payload ?? null,
    });

    return NextResponse.json({
      ok: true,
      id: data?.id,
      command: data?.command,
      created_at: data?.created_at,
      message: "Command queued; device will receive it on next poll.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
}
