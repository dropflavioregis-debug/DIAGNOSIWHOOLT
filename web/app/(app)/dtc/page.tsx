import { getSupabase } from "@/lib/supabase";
import type { DTCItem, ECUItem, AIMessage, MetricItem } from "@/lib/types";
import { MetricCard } from "@/components/common/MetricCard";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DTCListWithFilter } from "@/components/dtc/DTCListWithFilter";
import { ECUList } from "@/components/dtc/ECUList";
import { AIPanel } from "@/components/dashboard/AIPanel";
import { EmptyState } from "@/components/common/EmptyState";

type DtcRow = {
  code: string;
  description_it: string | null;
  description_en: string | null;
  severity: string | null;
  system: string | null;
};

function mapDtcRowToItem(row: DtcRow): DTCItem {
  const severity = (row.severity === "critical" || row.severity === "warning" || row.severity === "info"
    ? row.severity
    : "info") as DTCItem["severity"];
  return {
    code: row.code,
    name: row.code,
    description: row.description_it ?? row.description_en ?? "—",
    severity,
    type: "active",
    system: row.system ?? undefined,
  };
}

export default async function DTCPage() {
  const supabase = getSupabase();
  let dtcItems: DTCItem[] = [];
  let ecuItems: ECUItem[] = [];
  let metrics: MetricItem[] = [];
  let aiMessages: AIMessage[] = [];
  let lastScanAt: string | null = null;
  let lastSessionId: string | null = null;

  if (supabase) {
    const { data: session } = await supabase
      .from("sessions")
      .select("id, vehicle_id, started_at, raw_dtc, ai_diagnosis")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (session?.raw_dtc && session.raw_dtc.length > 0) {
      lastScanAt = session.started_at;
      lastSessionId = session.id;

      const { data: dtcRows } = await supabase
        .from("dtc")
        .select("code, description_it, description_en, severity, system")
        .in("code", session.raw_dtc);

      const byCode = new Map((dtcRows ?? []).map((r) => [r.code, r as DtcRow]));
      dtcItems = session.raw_dtc.map((code: string) =>
        mapDtcRowToItem(byCode.get(code) ?? { code, description_it: null, description_en: null, severity: null, system: null })
      );

      const activeCount = dtcItems.length;
      metrics = [
        { label: "DTC attivi", value: activeCount, unit: "", barPct: activeCount > 0 ? 100 : 0, barColor: "var(--red-600)", sub: activeCount > 0 ? "Richiedono attenzione" : "—" },
        { label: "DTC in sospeso", value: 0, unit: "", barPct: 0, barColor: "var(--amber-600)", sub: "—" },
        { label: "Centraline scansionate", value: 0, unit: "", barPct: 0, barColor: "var(--blue-400)", sub: "—" },
      ];
    }

    if (session?.ai_diagnosis) {
      aiMessages = [
        { title: "Diagnosi AI", body: session.ai_diagnosis, borderColor: "var(--blue-400)" },
      ];
    }
  }

  const hasDtc = dtcItems.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-[var(--color-text-primary)]">Errori DTC</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">Codici errore e centraline</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.length > 0 ? (
          metrics.map((m) => <MetricCard key={m.label} item={m} />)
        ) : (
          <>
            <div className="rounded-md bg-[var(--color-background-secondary)] px-4 py-3.5">
              <div className="mb-1.5 text-[11px] text-[var(--color-text-secondary)]">DTC attivi</div>
              <div className="text-base font-medium leading-none text-[var(--color-text-primary)] pt-1">0</div>
              <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">—</div>
            </div>
            <div className="rounded-md bg-[var(--color-background-secondary)] px-4 py-3.5">
              <div className="mb-1.5 text-[11px] text-[var(--color-text-secondary)]">DTC in sospeso</div>
              <div className="text-base font-medium leading-none text-[var(--color-text-primary)] pt-1">0</div>
              <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">—</div>
            </div>
            <div className="rounded-md bg-[var(--color-background-secondary)] px-4 py-3.5">
              <div className="mb-1.5 text-[11px] text-[var(--color-text-secondary)]">Centraline scansionate</div>
              <div className="text-base font-medium leading-none text-[var(--color-text-primary)] pt-1">—</div>
              <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">—</div>
            </div>
          </>
        )}
        {lastScanAt && (
          <div className="rounded-md bg-[var(--color-background-secondary)] px-4 py-3.5">
            <div className="mb-1.5 text-[11px] text-[var(--color-text-secondary)]">Ultima scansione</div>
            <div className="text-base font-medium leading-none text-[var(--color-text-primary)] pt-1">
              {new Date(lastScanAt).toLocaleString("it-IT")}
            </div>
            <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
              {lastSessionId ? `Sessione ${lastSessionId.slice(0, 8)}` : "—"}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <SectionCard title="">
          {hasDtc ? (
            <DTCListWithFilter items={dtcItems} />
          ) : (
            <EmptyState
              title="Nessun DTC"
              description="Avvia una sessione diagnostica per leggere i codici errore dal veicolo."
            />
          )}
        </SectionCard>
        <div className="flex flex-col gap-4">
          <SectionCard title="Centraline (ECU)">
            {ecuItems.length > 0 ? (
              <ECUList items={ecuItems} />
            ) : (
              <EmptyState
                title="Nessuna centralina"
                description="I dati ECU saranno disponibili dalla sessione."
              />
            )}
          </SectionCard>
          <SectionCard title="Analisi AI" action={<StatusBadge variant="green">Claude</StatusBadge>}>
            {aiMessages.length > 0 ? (
              <AIPanel messages={aiMessages} />
            ) : (
              <EmptyState
                title="Nessuna analisi AI"
                description="Esegui un'analisi con Claude per vedere la diagnosi."
              />
            )}
            <button
              type="button"
              className="mt-2 w-full rounded-md border border-[var(--color-border-secondary)] py-2 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-secondary)]"
            >
              Analisi completa con Claude ↗
            </button>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
