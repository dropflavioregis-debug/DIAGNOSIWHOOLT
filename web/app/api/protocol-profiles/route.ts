import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const { data, error } = await supabase
    .from("protocol_profiles")
    .select("id, name, description, category, created_at, updated_at, protocol_profile_versions(id, version, is_active, payload, created_at)")
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profiles: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    category?: string;
    payload?: unknown;
  };
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("protocol_profiles")
    .insert({
      name,
      description: body.description ?? null,
      category: body.category ?? "generic",
    })
    .select("id, name, description, category")
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ ok: false, error: profileError?.message ?? "Create failed" }, { status: 500 });
  }

  const { data: versionRow, error: versionError } = await supabase
    .from("protocol_profile_versions")
    .insert({
      profile_id: profile.id,
      version: 1,
      payload: body.payload ?? { steps: [] },
      is_active: true,
    })
    .select("id, version, is_active, payload")
    .single();
  if (versionError) {
    return NextResponse.json({ ok: false, error: versionError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile, version: versionRow });
}
