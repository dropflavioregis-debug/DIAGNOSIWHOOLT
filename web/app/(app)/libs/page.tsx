import { getSupabase } from "@/lib/supabase";
import type { MetricItem } from "@/lib/types";
import { MetricCard } from "@/components/common/MetricCard";
import { SectionCard } from "@/components/common/SectionCard";
import { EmptyState } from "@/components/common/EmptyState";

type RepoRow = { source_repo: string | null };

export default async function LibsPage() {
  const supabase = getSupabase();
  let vehicleCount = 0;
  let signalCount = 0;
  let dtcCount = 0;
  let repos: { name: string; meta: string; vehicles: string }[] = [];

  if (supabase) {
    const [vehiclesRes, signalsRes, dtcRes, reposRes] = await Promise.all([
      supabase.from("vehicles").select("id", { count: "exact", head: true }),
      supabase.from("signals").select("id", { count: "exact", head: true }),
      supabase.from("dtc").select("id", { count: "exact", head: true }),
      supabase.from("vehicles").select("source_repo").not("source_repo", "is", null),
    ]);

    vehicleCount = vehiclesRes.count ?? 0;
    signalCount = signalsRes.count ?? 0;
    dtcCount = dtcRes.count ?? 0;

    const repoSet = new Set<string>();
    for (const r of reposRes.data ?? []) {
      const repo = (r as RepoRow).source_repo;
      if (repo) repoSet.add(repo);
    }
    repos = Array.from(repoSet).map((name) => ({
      name,
      meta: "—",
      vehicles: "—",
    }));
  }

  const metrics: MetricItem[] = [
    { label: "Repo GitHub", value: repos.length, unit: "", barPct: repos.length > 0 ? 100 : 0, barColor: "#378ADD", sub: repos.length > 0 ? "Sorgenti importate" : "Nessuna" },
    { label: "Veicoli supportati", value: vehicleCount, unit: "", barPct: vehicleCount > 0 ? 100 : 0, barColor: "#1D9E75", sub: "In database" },
    { label: "Segnali totali", value: signalCount, unit: "", barPct: signalCount > 0 ? 100 : 0, barColor: "#EF9F27", sub: "DID + formule" },
    { label: "DTC nel database", value: dtcCount, unit: "", barPct: dtcCount > 0 ? 100 : 0, barColor: "#7F77DD", sub: "Codici errore" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-[var(--color-text-primary)]">Librerie</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">DID/DTC da repository GitHub</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} item={m} />
        ))}
      </div>

      <SectionCard
        title="Sorgenti GitHub"
        action={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
              <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-[#1D9E75]" />
              Sincronizza da script
            </span>
            <button
              type="button"
              className="rounded-md border border-[var(--color-border-secondary)] bg-transparent px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-secondary)]"
            >
              Sync ora
            </button>
          </div>
        }
      >
        {repos.length === 0 ? (
          <EmptyState
            title="Nessuna sorgente importata"
            description="Esegui lo script di import (scripts/import-to-supabase.ts) per caricare veicoli e segnali da JSON."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {repos.map((r) => (
              <li
                key={r.name}
                className="flex items-center gap-2.5 rounded-md border border-[var(--color-border-tertiary)] px-3 py-2.5 transition-colors hover:border-[var(--color-border-secondary)]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-background-secondary)] text-xs font-medium text-[var(--color-text-tertiary)]">
                  GH
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[var(--color-text-primary)]">{r.name}</div>
                  <div className="text-[11px] text-[var(--color-text-secondary)]">{r.meta}</div>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--color-text-tertiary)]">{r.vehicles}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
