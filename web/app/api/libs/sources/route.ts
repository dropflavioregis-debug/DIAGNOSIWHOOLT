import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { LIBS_BUCKET } from "@/lib/libs-import";

export const dynamic = "force-dynamic";

/** Lista i file libreria in Storage (per UI e re-import). */
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database non configurato", files: [] });
  }

  const { data: list, error } = await supabase.storage.from(LIBS_BUCKET).list("", {
    limit: 500,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    if (error.message?.includes("not found") || error.message?.includes("Bucket")) {
      return NextResponse.json({ ok: true, files: [] });
    }
    return NextResponse.json({ ok: false, error: error.message, files: [] });
  }

  const files = (list ?? [])
    .filter((f) => f.name?.endsWith(".json"))
    .map((f) => ({
      name: f.name,
      path: f.name,
      updated_at: f.updated_at ?? null,
    }));

  return NextResponse.json({ ok: true, files });
}
