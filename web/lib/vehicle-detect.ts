import type { SupabaseClient } from "@supabase/supabase-js";

export interface VehicleMatch {
  vehicle_id: string;
  make: string;
  model: string;
  lib_url: string;
}

function normalizeCanIds(ids: string[] | Record<string, unknown>): string[] {
  if (Array.isArray(ids)) return ids.map((x) => String(x).trim()).filter(Boolean);
  if (ids && typeof ids === "object") return Object.values(ids).map((x) => String(x).trim()).filter(Boolean);
  return [];
}

export async function detectVehicle(
  supabase: SupabaseClient | null,
  canIds: string[] | Record<string, unknown>
): Promise<VehicleMatch | null> {
  const ids = normalizeCanIds(canIds);
  if (!supabase || ids.length === 0) {
    return {
      vehicle_id: "00000000-0000-0000-0000-000000000001",
      make: "Unknown",
      model: "Unknown",
      lib_url: "/api/libs/00000000-0000-0000-0000-000000000001",
    };
  }
  const { data: vehicles } = await supabase.from("vehicles").select("id, make, model, can_ids").limit(50);
  if (!vehicles?.length) {
    return {
      vehicle_id: "00000000-0000-0000-0000-000000000001",
      make: "Unknown",
      model: "Unknown",
      lib_url: "/api/libs/00000000-0000-0000-0000-000000000001",
    };
  }
  const idSet = new Set(ids.map((x) => x.toLowerCase().replace(/^0x/, "")));
  for (const v of vehicles) {
    const row = v as { id: string; make: string; model: string; can_ids?: string[] };
    const vehicleIds = row.can_ids ?? [];
    const match = vehicleIds.some((cid) => idSet.has(String(cid).toLowerCase().replace(/^0x/, "")));
    if (match) {
      return {
        vehicle_id: row.id,
        make: row.make,
        model: row.model,
        lib_url: `/api/libs/${row.id}`,
      };
    }
  }
  return {
    vehicle_id: vehicles[0]?.id ?? "00000000-0000-0000-0000-000000000001",
    make: (vehicles[0] as { make?: string }).make ?? "Unknown",
    model: (vehicles[0] as { model?: string }).model ?? "Unknown",
    lib_url: `/api/libs/${vehicles[0]?.id ?? "00000000-0000-0000-0000-000000000001"}`,
  };
}
