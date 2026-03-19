import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  device_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
  raw_dtc: string[] | null;
  ai_diagnosis: string | null;
  can_fingerprint?: unknown;
  metadata?: unknown;
};

type ReadingRow = {
  id: string;
  signal_id: string;
  value: number | null;
  raw_value: string | null;
  recorded_at: string;
  name?: string | null;
};

function streamDocToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("it-IT", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing session id" }, { status: 400 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { ok: false, error: sessionError?.message ?? "Not found" },
      { status: 404 }
    );
  }

  const { data: readings } = await supabase
    .from("readings")
    .select("id, signal_id, value, raw_value, recorded_at")
    .eq("session_id", id)
    .order("recorded_at", { ascending: true });

  const out: ReadingRow[] = readings ?? [];
  if (out.length > 0) {
    const signalIds = Array.from(new Set(out.map((r) => r.signal_id).filter(Boolean)));
    const { data: sigs } = await supabase.from("signals").select("id, name").in("id", signalIds);
    const nameById = new Map((sigs ?? []).map((s) => [s.id, s.name]));
    out.forEach((r) => {
      (r as ReadingRow).name = nameById.get(r.signal_id) ?? null;
    });
  }

  const s = session as SessionRow;
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  doc.fontSize(18).text("Report diagnosi EV", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#666").text(`Sessione ${s.id}`, { align: "center" });
  doc.moveDown(1);

  doc.fontSize(11).fillColor("black");
  doc.text(`Data inizio: ${formatDate(s.started_at)}`);
  doc.text(`Data fine: ${formatDate(s.ended_at)}`);
  doc.text(`Device: ${s.device_id}`);
  doc.moveDown(1);

  const dtc = s.raw_dtc ?? [];
  if (dtc.length > 0) {
    doc.fontSize(12).text("Codici DTC", { underline: true });
    doc.fontSize(10);
    dtc.forEach((code) => doc.text(`• ${code}`));
    doc.moveDown(1);
  }

  if (s.ai_diagnosis) {
    doc.fontSize(12).text("Diagnosi AI", { underline: true });
    doc.fontSize(10);
    doc.text(s.ai_diagnosis, { align: "justify", lineGap: 2 });
    doc.moveDown(1);
  }

  if (out.length > 0) {
    doc.fontSize(12).text("Letture segnali", { underline: true });
    doc.fontSize(9);
    const cols = ["Segnale", "Valore", "Data"];
    const colWidths = [180, 80, 180];
    let y = doc.y;
    doc.text(cols[0], 50, y);
    doc.text(cols[1], 50 + colWidths[0], y);
    doc.text(cols[2], 50 + colWidths[0] + colWidths[1], y);
    doc.moveDown(0.4);
    y = doc.y;
    const maxRows = 40;
    const rows = out.slice(-maxRows);
    rows.forEach((r, i) => {
      const name = (r.name ?? r.signal_id) as string;
      const val = r.value != null ? String(r.value) : (r.raw_value ?? "—");
      const rec = formatDate(r.recorded_at);
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.text(name.slice(0, 35), 50, y);
      doc.text(String(val).slice(0, 12), 50 + colWidths[0], y);
      doc.text(rec, 50 + colWidths[0] + colWidths[1], y);
      y += 14;
    });
    if (out.length > maxRows) {
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor("#666").text(`(ultime ${maxRows} di ${out.length} letture)`);
    }
  }

  doc.end();
  const buffer = await streamDocToBuffer(doc);

  const filename = `report-diagnosi-${id.slice(0, 8)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
