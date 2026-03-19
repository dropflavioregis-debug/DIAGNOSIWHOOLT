import { getSupabase } from "@/lib/supabase";
import type { MetricItem } from "@/lib/types";
import { MetricCard } from "@/components/common/MetricCard";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ChatPanel } from "@/components/ai/ChatPanel";
import { TriggerList } from "@/components/ai/TriggerList";

const COST_ROWS = [
  { label: "Analisi DTC", val: "~€0.003/chiamata" },
  { label: "Report sessione", val: "~€0.005" },
  { label: "Chat singola", val: "~€0.0015" },
  { label: "Totale uso normale", val: "~€1.80/mese (100 sessioni)" },
];

export default async function AIPage() {
  const supabase = getSupabase();
  let analysisCount = 0;

  if (supabase) {
    const { count } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .not("ai_diagnosis", "is", null);
    analysisCount = count ?? 0;
  }

  const metrics: MetricItem[] = [
    { label: "Analisi totali", value: analysisCount, unit: "", barPct: analysisCount > 0 ? 100 : 0, barColor: "#378ADD", sub: "Sessioni con diagnosi AI" },
    { label: "Costo API stimato", value: 0, unit: "€", barPct: 0, barColor: "#1D9E75", sub: "—" },
    { label: "Tempo risposta medio", value: 0, unit: "s", barPct: 0, barColor: "#7F77DD", sub: "claude-sonnet-4" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-[var(--color-text-primary)]">AI Diagnosi</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">Analisi con Claude</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {metrics.map((m) => (
          <MetricCard key={m.label} item={m} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="">
          <ChatPanel />
        </SectionCard>
        <div className="flex flex-col gap-4">
          <SectionCard title="Trigger automatici" action={<StatusBadge variant="blue">Attivi</StatusBadge>}>
            <TriggerList />
          </SectionCard>
          <SectionCard title="Costi API dettaglio">
            <div className="flex flex-col">
              {COST_ROWS.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between border-b border-[var(--color-border-tertiary)] py-1.5 last:border-0"
                >
                  <span className="text-xs text-[var(--color-text-secondary)]">{r.label}</span>
                  <span className="text-xs font-medium text-[var(--color-text-primary)]">{r.val}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
