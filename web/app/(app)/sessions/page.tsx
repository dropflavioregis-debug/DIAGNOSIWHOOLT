"use client";

import { useState, useEffect, useCallback } from "react";
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

type SessionsMetrics = {
  total_distance_km: number;
  total_energy_kwh: number;
  computed_from_readings: boolean;
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
  const [showStartModal, setShowStartModal] = useState(false);
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [manualDeviceId, setManualDeviceId] = useState("");
  const [commandSending, setCommandSending] = useState(false);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SessionsMetrics>({
    total_distance_km: 0,
    total_energy_kwh: 0,
    computed_from_readings: false,
  });

  const loadSessions = useCallback(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data: { sessions?: SessionItem[]; metrics?: SessionsMetrics }) => {
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
        if (data.metrics && typeof data.metrics === "object") {
          setMetrics({
            total_distance_km:
              typeof data.metrics.total_distance_km === "number" ? data.metrics.total_distance_km : 0,
            total_energy_kwh:
              typeof data.metrics.total_energy_kwh === "number" ? data.metrics.total_energy_kwh : 0,
            computed_from_readings: Boolean(data.metrics.computed_from_readings),
          });
        }
      })
      .catch(() => {
        setSessions([]);
        setMetrics({ total_distance_km: 0, total_energy_kwh: 0, computed_from_readings: false });
      });
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!showStartModal) return;
    setCommandMessage(null);
    fetch("/api/device/commands")
      .then((res) => res.json())
      .then((data: { devices?: string[] }) => {
        const list = Array.isArray(data.devices) ? data.devices : [];
        setDevices(list);
        setSelectedDevice(list[0] ?? "");
      })
      .catch(() => setDevices([]));
  }, [showStartModal]);

  async function sendStartSessionCommand() {
    const targetDevice = (manualDeviceId.trim() || selectedDevice || "").trim();
    if (!targetDevice) {
      setCommandMessage("Inserisci o seleziona un device_id");
      return;
    }
    setCommandSending(true);
    setCommandMessage(null);
    try {
      const res = await fetch("/api/device/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: targetDevice, command: "start_session" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (data.ok) {
        setCommandMessage(`Comando inviato a ${targetDevice}. Il dispositivo lo riceverà al prossimo polling e avvierà una nuova sessione.`);
        window.setTimeout(() => loadSessions(), 3000);
        window.setTimeout(() => loadSessions(), 8000);
      } else {
        setCommandMessage(data.error ?? "Errore invio comando");
      }
    } catch {
      setCommandMessage("Errore di rete");
    } finally {
      setCommandSending(false);
    }
  }

  const totalSessions = sessions.length;
  const activeSession = sessions.find((s) => !s.ended_at);

  const sessionMetrics: MetricItem[] = [
    { label: "Sessioni totali", value: totalSessions, unit: "", barPct: totalSessions > 0 ? 100 : 0, barColor: "#378ADD", sub: totalSessions > 0 ? "In database" : "Nessuna sessione" },
    {
      label: "km totali loggati",
      value: metrics.total_distance_km,
      unit: "",
      barPct: metrics.total_distance_km > 0 ? 100 : 0,
      barColor: "#1D9E75",
      sub: metrics.computed_from_readings ? "Da letture segnali" : "Dati non disponibili",
    },
    {
      label: "kWh consumati",
      value: metrics.total_energy_kwh,
      unit: "",
      barPct: metrics.total_energy_kwh > 0 ? 100 : 0,
      barColor: "#EF9F27",
      sub: metrics.computed_from_readings ? "Da letture segnali" : "Dati non disponibili",
    },
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-medium text-[var(--color-text-primary)]">Sessioni</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">Cronologia sessioni diagnostica</p>
        </div>
        <button
          type="button"
          onClick={() => setShowStartModal(true)}
          className="rounded-[var(--border-radius-md)] px-3 py-2 text-xs font-medium transition-colors"
          style={{
            background: "var(--teal-500)",
            color: "white",
            border: "none",
          }}
        >
          Avvia diagnosi
        </button>
      </div>

      {showStartModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowStartModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="start-diagnostic-title"
        >
          <div
            className="max-w-md rounded-[var(--border-radius-md)] p-5 shadow-lg"
            style={{ background: "var(--color-background-primary)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="start-diagnostic-title" className="mb-3 text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              Avvia connessione con il veicolo
            </h2>
            <ol className="mb-4 list-decimal space-y-2 pl-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>
              <li>Collega l’ESP32 alla presa OBD2 del veicolo (accendi l’auto se necessario).</li>
              <li>Assicurati che il dispositivo sia sulla stessa rete WiFi del server (o che abbia già inviato dati).</li>
              <li>Apri la pagina del dispositivo nel browser: <strong style={{ color: "var(--color-text-primary)" }}>http://&lt;IP del dispositivo&gt;</strong> (l’IP è stampato sul monitor seriale oppure nella lista dispositivi del router).</li>
              <li>Clicca <strong style={{ color: "var(--color-text-primary)" }}>«Avvia connessione con il veicolo»</strong> sulla pagina del dispositivo.</li>
              <li>La nuova sessione apparirà qui sotto entro pochi secondi.</li>
            </ol>
            <p className="mb-4 text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
              Per cambiare WiFi, URL server o API key usa il pulsante «Apri configurazione» sulla pagina del dispositivo.
            </p>

            <div
              className="mb-4 rounded-[var(--border-radius-md)] py-3 pr-3 pl-3"
              style={{ border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)" }}
            >
              <div className="mb-2 text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                Invia comando dal web
              </div>
              <p className="mb-2 text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                Scegli il dispositivo o inserisci il suo device_id e invia «Avvia sessione». Il dispositivo riceverà il comando al prossimo polling.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {devices.length > 0 && (
                  <select
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    className="rounded-[var(--border-radius-md)] bg-[var(--color-background-primary)] px-2.5 py-1.5 text-xs"
                    style={{ border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-primary)" }}
                  >
                    {devices.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={manualDeviceId}
                  onChange={(e) => setManualDeviceId(e.target.value)}
                  placeholder="oppure inserisci device_id (es. EV-Diag-01)"
                  className="min-w-[240px] rounded-[var(--border-radius-md)] bg-[var(--color-background-primary)] px-2.5 py-1.5 text-xs"
                  style={{ border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-primary)" }}
                />
                <button
                  type="button"
                  disabled={commandSending}
                  onClick={sendStartSessionCommand}
                  className="rounded-[var(--border-radius-md)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  style={{ background: "var(--teal-500)", color: "white", border: "none" }}
                >
                  {commandSending ? "Invio…" : "Avvia sessione su questo dispositivo"}
                </button>
              </div>
              {devices.length === 0 && (
                <p className="mt-2 text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                  Nessun dispositivo in lista: usa il campo manuale con il device_id configurato nell&apos;ESP32.
                </p>
              )}
              {commandMessage && (
                <p className="mt-2 text-[11px]" style={{ color: "var(--teal-600)" }}>
                  {commandMessage}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <a
                href="/device"
                className="rounded-[var(--border-radius-md)] px-3 py-1.5 text-xs transition-colors"
                style={{ border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", textDecoration: "none" }}
              >
                Pagina dispositivo
              </a>
              <button
                type="button"
                onClick={() => setShowStartModal(false)}
                className="rounded-[var(--border-radius-md)] px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "none" }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

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
          <a
            href="/api/sessions/export"
            download="sessions-export.csv"
            className="rounded-[var(--border-radius-md)] bg-transparent px-2.5 py-1 text-[11px] transition-colors hover:bg-[var(--color-background-secondary)]"
            style={{ border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-secondary)", textDecoration: "none" }}
          >
            Esporta CSV ↗
          </a>
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
