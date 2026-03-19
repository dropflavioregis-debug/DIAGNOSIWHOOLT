import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  if (!supabase) {
    const hasUrl = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    );
    const hasKey = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    return NextResponse.json(
      {
        ok: false,
        message: "Supabase non configurato",
        detail: hasUrl
          ? hasKey
            ? "URL e key presenti ma client non creato (controlla formato variabili)."
            : "Manca SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY in .env"
          : "Manca NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL in .env",
      },
      { status: 503 }
    );
  }
  try {
    const { count, error } = await supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true });
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: "Errore database",
          detail: error.message,
          code: error.code,
          hint: error.details,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      message: "Connessione database OK",
      detail: `Tabella vehicles raggiungibile (${count ?? 0} veicoli).`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore sconosciuto";
    return NextResponse.json(
      { ok: false, message: "Eccezione", detail: msg },
      { status: 500 }
    );
  }
}
