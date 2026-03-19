import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  device_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
  raw_dtc: string[] | null;
  ai_diagnosis: string | null;
};

function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const { data, error } = await supabase
    .from("sessions")
    .select("id, device_id, vehicle_id, started_at, ended_at, raw_dtc, ai_diagnosis")
    .order("started_at", { ascending: false })
    .limit(500);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as SessionRow[];
  const headers = ["id", "device_id", "vehicle_id", "started_at", "ended_at", "raw_dtc", "ai_diagnosis"];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h as keyof SessionRow];
          if (h === "raw_dtc" && Array.isArray(v)) return escapeCsvCell(JSON.stringify(v));
          return escapeCsvCell(v);
        })
        .join(",")
    ),
  ];
  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sessions-export.csv"',
    },
  });
}
