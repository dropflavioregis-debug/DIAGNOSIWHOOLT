import { getSupabase } from "@/lib/supabase";
import type { BatteryReading } from "@/lib/types";
import { getBatteryMetrics } from "@/lib/battery-utils";
import { MetricCard } from "@/components/common/MetricCard";
import { SectionCard } from "@/components/common/SectionCard";
import { CellGrid } from "@/components/battery/CellGrid";
import { EmptyState } from "@/components/common/EmptyState";

export default async function BatteryPage() {
  const supabase = getSupabase();
  let batteryReading: BatteryReading | null = null;

  if (supabase) {
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (session) {
      const { data: readings } = await supabase
        .from("readings")
        .select("value, signals(name)")
        .eq("session_id", session.id)
        .order("recorded_at", { ascending: false })
        .limit(200);

      if (readings?.length) {
        const byName = new Map<string, number>();
        for (const r of readings) {
          const name = (r.signals as { name?: string } | null)?.name;
          const val = (r as { value?: number }).value;
          if (name != null && typeof val === "number" && !byName.has(name)) {
            byName.set(name, val);
          }
        }
        const soc = byName.get("SOC") ?? byName.get("soc") ?? 0;
        const soh = byName.get("SOH") ?? byName.get("soh") ?? 0;
        const packV = byName.get("PackVoltage") ?? byName.get("pack_voltage") ?? 0;
        const cellTemps = readings
          .filter((r) => {
            const n = (r.signals as { name?: string } | null)?.name?.toLowerCase() ?? "";
            return n.includes("cell") || n.includes("temp");
          })
          .slice(0, 96)
          .map((r) => (r as { value: number }).value);
        const temps = cellTemps.length ? cellTemps : [];
        const tempMax = temps.length ? Math.max(...temps) : 0;
        const tempMin = temps.length ? Math.min(...temps) : 0;
        const tempAvg = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : 0;
        batteryReading = {
          soc,
          soh,
          tempMax,
          tempMin,
          tempAvg,
          packVoltage: packV,
          cellTemps: temps.length ? temps : [],
        };
      }
    }
  }

  const hasData = batteryReading !== null && (batteryReading.cellTemps.length > 0 || batteryReading.soc > 0 || batteryReading.soh > 0 || batteryReading.packVoltage > 0);
  const batteryMetrics = hasData && batteryReading ? getBatteryMetrics(batteryReading) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-[var(--color-text-primary)]">Batteria</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">Metriche e mappa celle</p>
      </div>

      {!hasData ? (
        <EmptyState
          title="Nessun dato batteria"
          description="Avvia una sessione diagnostica e invia letture dal dispositivo per vedere SOC, SOH e temperature celle."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {batteryMetrics.map((m) => (
              <MetricCard key={m.label} item={m} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Mappa termica celle"
              action={batteryReading && batteryReading.cellTemps.length > 0 ? undefined : undefined}
            >
              {batteryReading && batteryReading.cellTemps.length > 0 ? (
                <CellGrid cellTemps={batteryReading.cellTemps} columns={12} />
              ) : (
                <EmptyState
                  title="Nessuna lettura celle"
                  description="Le temperature delle celle saranno mostrate quando disponibili."
                />
              )}
            </SectionCard>

            <SectionCard
              title="SOH storico"
              action={
                <button
                  type="button"
                  className="rounded-md border border-[var(--color-border-secondary)] bg-transparent px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-secondary)]"
                >
                  Esporta ↗
                </button>
              }
            >
              <div className="h-[120px] rounded-md bg-[var(--color-background-secondary)] flex items-center justify-center text-[11px] text-[var(--color-text-tertiary)]">
                Grafico SOH (dati storici non ancora disponibili)
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div className="rounded-md bg-[var(--color-background-secondary)] p-2 text-center">
                  <div className="text-[10px] text-[var(--color-text-tertiary)]">Degradazione/anno</div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">—</div>
                </div>
                <div className="rounded-md bg-[var(--color-background-secondary)] p-2 text-center">
                  <div className="text-[10px] text-[var(--color-text-tertiary)]">Cicli stimati</div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">—</div>
                </div>
                <div className="rounded-md bg-[var(--color-background-secondary)] p-2 text-center">
                  <div className="text-[10px] text-[var(--color-text-tertiary)]">80% target</div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">—</div>
                </div>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
