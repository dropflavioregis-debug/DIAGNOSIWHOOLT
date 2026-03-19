import { getSupabase } from "@/lib/supabase";
import type { MetricItem } from "@/lib/types";
import { MetricCard } from "@/components/common/MetricCard";
import { SectionCard } from "@/components/common/SectionCard";
import { EmptyState } from "@/components/common/EmptyState";
import { LibsImportForm } from "@/components/libs/LibsImportForm";
import { LibsStorageList } from "@/components/libs/LibsStorageList";

type VehicleRow = { id: string; make: string; model: string; source_repo: string | null };
type SignalRow = { vehicle_id: string | null };

export default async function LibsPage() {
  const supabase = getSupabase();
  let vehicleCount = 0;
  let signalCount = 0;
  let dtcCount = 0;
  let vehicles: { id: string; make: string; model: string; source_repo: string | null; signalCount: number }[] = [];

  if (supabase) {
    const [vehiclesRes, signalsRes, dtcRes, allVehiclesRes, allSignalsRes] = await Promise.all([
      supabase.from("vehicles").select("id", { count: "exact", head: true }),
      supabase.from("signals").select("id", { count: "exact", head: true }),
      supabase.from("dtc").select("id", { count: "exact", head: true }),
      supabase.from("vehicles").select("id, make, model, source_repo").order("make").order("model"),
      supabase.from("signals").select("vehicle_id"),
    ]);

    vehicleCount = vehiclesRes.count ?? 0;
    signalCount = signalsRes.count ?? 0;
    dtcCount = dtcRes.count ?? 0;

    const countByVehicle: Record<string, number> = {};
    for (const s of allSignalsRes.data ?? []) {
      const vid = (s as SignalRow).vehicle_id;
      if (vid) countByVehicle[vid] = (countByVehicle[vid] ?? 0) + 1;
    }

    vehicles = ((allVehiclesRes.data ?? []) as VehicleRow[]).map((v) => ({
      id: v.id,
      make: v.make,
      model: v.model,
      source_repo: v.source_repo ?? null,
      signalCount: countByVehicle[v.id] ?? 0,
    }));
  }

  const metrics: MetricItem[] = [
    {
      label: "Veicoli supportati",
      value: vehicleCount,
      unit: "",
      barPct: vehicleCount > 0 ? 100 : 0,
      barColor: "#1D9E75",
      sub: "In database",
    },
    {
      label: "Segnali totali",
      value: signalCount,
      unit: "",
      barPct: signalCount > 0 ? 100 : 0,
      barColor: "#EF9F27",
      sub: "DID + formule",
    },
    {
      label: "DTC nel database",
      value: dtcCount,
      unit: "",
      barPct: dtcCount > 0 ? 100 : 0,
      barColor: "#7F77DD",
      sub: "Codici errore",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-[var(--color-text-primary)]">Librerie</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">Veicoli, segnali e DTC — importa da URL o carica file (Storage Supabase)</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <MetricCard key={m.label} item={m} />
        ))}
      </div>

      <SectionCard title="Importa libreria">
        <LibsImportForm />
      </SectionCard>

      <SectionCard title="File in Storage (Supabase)">
        <LibsStorageList />
      </SectionCard>

      <SectionCard title="Librerie installate (per diagnosi)">
        {vehicles.length === 0 ? (
          <EmptyState
            title="Nessuna libreria"
            description="Importa da URL o carica un file JSON sopra. I dati andranno nel database e saranno usati per la diagnosi."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {vehicles.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-2.5 rounded-md border border-[var(--color-border-tertiary)] px-3 py-2.5 transition-colors hover:border-[var(--color-border-secondary)]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-background-tertiary)] text-xs font-medium text-[var(--color-text-tertiary)]">
                  {v.make.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[var(--color-text-primary)]">
                    {v.make} {v.model}
                  </div>
                  {v.source_repo && (
                    <div className="truncate text-[11px] text-[var(--color-text-secondary)]" title={v.source_repo}>
                      {v.source_repo}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-[var(--color-text-tertiary)]">
                  {v.signalCount} segnali
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
