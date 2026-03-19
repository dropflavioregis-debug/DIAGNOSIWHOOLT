"use client";

import { useState, useEffect } from "react";
import type { MetricItem } from "@/lib/types";
import { MetricCard } from "@/components/common/MetricCard";
import { SectionCard } from "@/components/common/SectionCard";
import { EmptyState } from "@/components/common/EmptyState";

type SessionItem = {
  id: string;
  device_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
  raw_dtc: string[] | null;
  ai_diagnosis: string | null;
};

function formatSessionStarted(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffM = Math.floor(diffMs / 60000);
    if (diffM < 1) return "Adesso";
    if (diffM < 60) return `${diffM} min fa`;
    const diffH = Math.floor(diffM / 60);
    if (diffH < 24) return `Oggi ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function SessionsPage() {
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data: { sessions?: SessionItem[] }) => {
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      })
      .catch(() => setSessions([]));
  }, []);

  const totalSessions = sessions.length;
  const activeSession = sessions.find((s) => !s.ended_at);

  const sessionMetrics: MetricItem[] = [
    { label: "Sessioni totali", value: totalSessions, unit: "", barPct: totalSessions > 0 ? 100 : 0, barColor: "#378ADD", sub: totalSessions > 0 ? "In database" : "Nessuna sessione" },
    { label: "km totali loggati", value: 0, unit: "", barPct: 0, barColor: "#1D9E75", sub: "—" },
    { label: "kWh consumati", value: 0, unit: "", barPct: 0, barColor: "#EF9F27", sub: "—" },
  ];

  const list = sessions.map((s) => ({
    id: s.id,
    started: formatSessionStarted(s.started_at),
    status: (s.ended_at ? "completed" : "active") as "active" | "completed",
    vehicle: s.device_id,
  }));

  const filteredList = list.filter(
    (s) => !search || String(s.vehicle).toLowerCase().includes(search.toLowerCase()) || s.id.includes(search)
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-[var(--color-text-primary)]">Sessioni</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">Cronologia sessioni diagnostica</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {sessionMetrics.map((m) => (
          <MetricCard key={m.label} item={m} />
        ))}
        {activeSession && (
          <div className="rounded-[var(--border-radius-md)] bg-[var(--color-background-secondary)] px-4 py-3.5">
            <div className="mb-1.5 text-[11px] text-[var(--color-text-secondary)]">Sessione attiva</div>
            <div className="text-sm font-medium pt-1" style={{ color: "var(--teal-400)" }}>
              {activeSession.id.slice(0, 8)} live
            </div>
            <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
              Iniziata {formatSessionStarted(activeSession.started_at)}
            </div>
          </div>
        )}
      </div>

      <SectionCard
        title="Sessioni"
        action={
          <button
            type="button"
            className="rounded-[var(--border-radius-md)] bg-transparent px-2.5 py-1 text-[11px] transition-colors hover:bg-[var(--color-background-secondary)]"
            style={{ border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)" }}
          >
            Esporta CSV ↗
          </button>
        }
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per data, DTC, dispositivo…"
          className="mb-3 w-full rounded-[var(--border-radius-md)] bg-[var(--color-background-primary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
          style={{ border: "0.5px solid var(--color-border-secondary)" }}
        />
        {filteredList.length === 0 ? (
          <EmptyState
            title="Nessuna sessione"
            description="Le sessioni appariranno qui quando un dispositivo invierà dati."
          />
        ) : (
          <ul className="flex flex-col" style={{ gap: "8px" }}>
            {filteredList.map((s) => (
              <li
                key={s.id}
                className="cursor-pointer overflow-hidden rounded-[var(--border-radius-md)] transition-colors hover:border-[var(--color-border-secondary)]"
                style={{
                  border: s.status === "active"
                    ? "2px solid var(--color-border-info)"
                    : "0.5px solid var(--color-border-tertiary)",
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
                  onClick={() => setOpenId(openId === s.id ? null : s.id)}
                >
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: s.status === "active" ? "var(--teal-400)" : "var(--color-text-tertiary)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-xs font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      Sessione {s.id.slice(0, 8)} · {s.vehicle}
                    </div>
                    <div
                      className="text-[11px]"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {s.started}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={
                      s.status === "active"
                        ? { background: "var(--green-50)", color: "var(--green-600)" }
                        : { background: "var(--color-background-secondary)", color: "var(--color-text-tertiary)" }
                    }
                  >
                    {s.status === "active" ? "Live" : "Completata"}
                  </span>
                </button>
                {openId === s.id && (
                  <div
                    className="px-3 pb-3 pt-2"
                    style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <a
                        href={`/api/sessions/${s.id}/export`}
                        download
                        className="inline-flex items-center rounded-[var(--border-radius-md)] bg-transparent px-2.5 py-1.5 text-[11px] transition-colors hover:bg-[var(--color-background-secondary)]"
                        style={{ border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)" }}
                      >
                        Scarica report PDF
                      </a>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
