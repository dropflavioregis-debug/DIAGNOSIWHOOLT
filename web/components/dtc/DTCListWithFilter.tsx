"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DTCItem, DTCFilter } from "@/lib/types";
import { StatusBadge } from "@/components/common/StatusBadge";

const severityStyle: Record<DTCItem["severity"], { bar: string; codeBg: string; codeFg: string; badge: "red" | "amber" | "blue" }> = {
  critical: { bar: "var(--red-400)", codeBg: "var(--red-50)", codeFg: "var(--red-600)", badge: "red" },
  warning: { bar: "var(--amber-200)", codeBg: "var(--amber-50)", codeFg: "var(--amber-600)", badge: "amber" },
  info: { bar: "var(--blue-400)", codeBg: "var(--blue-50)", codeFg: "var(--blue-600)", badge: "blue" },
};

interface DTCListWithFilterProps {
  items: DTCItem[];
  onScan?: () => void;
  onClear?: () => void;
}

const FILTER_KEYS: { key: DTCFilter; label: string }[] = [
  { key: "all", label: "Tutti" },
  { key: "active", label: "Attivi" },
  { key: "pending", label: "In sospeso" },
  { key: "cleared", label: "Cancellati" },
];

function filterItems(items: DTCItem[], filter: DTCFilter): DTCItem[] {
  if (filter === "all") return items;
  return items.filter((d) => d.type === filter);
}

function getCount(items: DTCItem[], filter: DTCFilter): number {
  if (filter === "all") return items.length;
  return items.filter((d) => d.type === filter).length;
}

export function DTCListWithFilter({ items, onScan, onClear }: DTCListWithFilterProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<DTCFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const filtered = filterItems(items, filter);
  const filtersWithCount = FILTER_KEYS.map((f) => ({ ...f, count: getCount(items, f.key) }));

  const handleScan = () => {
    if (scanning) return;
    setScanning(true);
    setScanProgress(0);
    const steps = 6;
    let n = 0;
    const iv = setInterval(() => {
      n++;
      setScanProgress((n / steps) * 100);
      if (n >= steps) {
        clearInterval(iv);
        setScanning(false);
      }
    }, 350);
    onScan?.();
  };

  return (
    <div className="flex flex-col" style={{ gap: "12px" }}>
      <div className="flex flex-wrap items-center justify-between" style={{ gap: "8px" }}>
        <span
          className="text-[13px] font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          Codici errore
        </span>
        <div className="flex" style={{ gap: "8px" }}>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="rounded-[var(--border-radius-md)] bg-transparent text-xs font-medium transition-colors hover:bg-[var(--color-background-secondary)] disabled:opacity-50"
            style={{
              border: "0.5px solid var(--color-border-secondary)",
              color: "var(--color-text-primary)",
              padding: "5px 12px",
            }}
          >
            {scanning ? "Scansione…" : "Nuova scansione"}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-[var(--border-radius-md)] bg-transparent text-xs font-medium transition-colors hover:bg-[var(--color-background-secondary)]"
            style={{
              border: "0.5px solid var(--color-border-danger)",
              color: "var(--color-text-danger)",
              padding: "5px 12px",
            }}
          >
            Cancella tutti
          </button>
        </div>
      </div>

      {scanning && (
        <div>
          <div
            className="mb-1 text-[11px]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Interrogando ECU…
          </div>
          <div
            className="h-1 overflow-hidden rounded-sm"
            style={{ background: "var(--color-border-tertiary)" }}
          >
            <div
              className="h-full rounded-sm transition-[width] duration-300"
              style={{ width: `${scanProgress}%`, background: "var(--teal-400)" }}
            />
          </div>
        </div>
      )}

      <div className="flex" style={{ gap: "2px", marginBottom: "14px" }}>
        {filtersWithCount.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className="rounded-[var(--border-radius-md)] border-none cursor-pointer text-xs font-medium transition-colors hover:opacity-90"
            style={{
              padding: "5px 12px",
              background: filter === f.key ? "var(--color-background-secondary)" : "transparent",
              color: filter === f.key ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              fontWeight: filter === f.key ? 500 : 400,
            }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <ul className="flex flex-col" style={{ gap: "8px" }}>
        {filtered.map((d) => {
          const style = severityStyle[d.severity];
          const isExpanded = expandedId === d.code;
          return (
            <li
              key={d.code}
              className="overflow-hidden rounded-[var(--border-radius-md)] transition-colors hover:border-[var(--color-border-secondary)] cursor-pointer"
              style={{
                border: "0.5px solid var(--color-border-tertiary)",
                background: "var(--color-background-tertiary)",
              }}
            >
              <button
                type="button"
                className="flex w-full items-center text-left border-0 cursor-pointer"
                style={{
                  gap: "10px",
                  padding: "10px 12px",
                  background: "transparent",
                  color: "inherit",
                }}
                onClick={() => setExpandedId(isExpanded ? null : d.code)}
              >
                <div
                  className="w-0.5 self-stretch rounded-sm shrink-0"
                  style={{ background: style.bar }}
                  aria-hidden
                />
                <span
                  className="shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-medium"
                  style={{ background: style.codeBg, color: style.codeFg }}
                >
                  {d.code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-[var(--color-text-primary)]">{d.name}</div>
                  <div className="text-[11px] text-[var(--color-text-secondary)]">
                    {d.ecu} · {d.ecu_addr} · {d.type === "active" ? "Attivo" : d.type === "pending" ? "In sospeso" : "Storico"}
                  </div>
                </div>
                <StatusBadge variant={style.badge}>
                  {d.severity === "critical" ? "Critico" : d.severity === "warning" ? "Avviso" : "Info"}
                </StatusBadge>
              </button>
              {isExpanded && d.causes !== undefined && (
                <div
                  className="px-3 pb-3 pl-6 pt-2"
                  style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md bg-[var(--color-background-secondary)] p-2.5">
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        Cause probabili
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{d.causes}</div>
                    </div>
                    <div className="rounded-md bg-[var(--color-background-secondary)] p-2.5">
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        Azione consigliata
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{d.action}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/ai?code=${encodeURIComponent(d.code)}`)}
                    className="mt-2 text-[11px] text-[var(--color-text-info)] hover:underline"
                  >
                    Analisi dettagliata AI ↗
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
