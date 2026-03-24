import { getSupabase } from "@/lib/supabase";
import { SectionCard } from "@/components/common/SectionCard";
import { ControlPlanePanel } from "@/components/backend/ControlPlanePanel";

type ApiRow = {
  area: string;
  endpoint: string;
  methods: string;
  usedBy: string;
  notes: string;
};

const API_ROWS: ApiRow[] = [
  {
    area: "Ingest",
    endpoint: "/api/ingest",
    methods: "POST",
    usedBy: "Firmware, Test UI",
    notes: "Riceve dati ESP32 e salva sessione/readings (con VIN decode).",
  },
  {
    area: "Sessioni",
    endpoint: "/api/sessions, /api/sessions/[id], export",
    methods: "GET",
    usedBy: "Sessioni, Dashboard, Export",
    notes: "Lista/dettaglio sessioni e report CSV/PDF.",
  },
  {
    area: "Comandi dispositivo",
    endpoint: "/api/device/commands",
    methods: "GET, POST",
    usedBy: "Firmware polling, Sessioni UI",
    notes: "Queue comandi verso ESP32; firmware gestisce start_session e sniffer_active.",
  },
  {
    area: "CAN Sniffer",
    endpoint: "/api/can-sniffer/stream, /api/can-sniffer/subscribe",
    methods: "GET, POST, DELETE",
    usedBy: "Firmware, Dashboard",
    notes: "Frame e stato sniffer in memoria (non persistenti).",
  },
  {
    area: "VIN",
    endpoint: "/api/vin/decode",
    methods: "GET, POST",
    usedBy: "Tool UI, backend ingest",
    notes: "Decodifica VIN 17 caratteri.",
  },
  {
    area: "Vehicle detect",
    endpoint: "/api/vehicle/detect",
    methods: "POST",
    usedBy: "Firmware, Tool UI",
    notes: "Rileva veicolo da can_ids/can_fingerprint.",
  },
  {
    area: "Librerie",
    endpoint: "/api/libs/*",
    methods: "GET, POST",
    usedBy: "Pagina Librerie",
    notes: "Import/lista sorgenti e libreria per veicolo.",
  },
  {
    area: "AI",
    endpoint: "/api/analyze",
    methods: "POST",
    usedBy: "AI Diagnosi",
    notes: "Analisi testuale DTC con Claude.",
  },
  {
    area: "Firmware OTA",
    endpoint: "/api/firmware/latest",
    methods: "GET",
    usedBy: "Firmware",
    notes: "Metadata versione firmware disponibile.",
  },
];

const DEVICE_PROTOCOL_ROWS = [
  { protocol: "Command queue", shape: "command + payload JSON", implemented: "start_session, sniffer_active" },
  { protocol: "CAN stream", shape: "frames[{id,len,data[]}]", implemented: "POST /api/can-sniffer/stream" },
  { protocol: "Vehicle fingerprint", shape: "can_ids[] / can_fingerprint{}", implemented: "POST /api/vehicle/detect" },
];

export default async function BackendPage() {
  const supabase = getSupabase();

  let vehiclesCount = 0;
  let sessionsCount = 0;
  let pendingCommands = 0;
  let updateEvents24h = 0;

  if (supabase) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [vehiclesRes, sessionsRes, commandsRes, updatesRes] = await Promise.all([
      supabase.from("vehicles").select("id", { count: "exact", head: true }),
      supabase.from("sessions").select("id", { count: "exact", head: true }),
      supabase
        .from("device_commands")
        .select("id", { count: "exact", head: true })
        .is("acknowledged_at", null),
      supabase
        .from("device_update_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
    ]);
    vehiclesCount = vehiclesRes.count ?? 0;
    sessionsCount = sessionsRes.count ?? 0;
    pendingCommands = commandsRes.count ?? 0;
    updateEvents24h = updatesRes.count ?? 0;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-[var(--color-text-primary)]">API & Protocolli</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Interfaccia backend reale: endpoint disponibili, chi li usa e protocollo firmware/webapp.
        </p>
      </div>

      <SectionCard title="Stato rapido backend">
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-md border border-[var(--color-border-tertiary)] px-3 py-2">
            <div className="text-[11px] text-[var(--color-text-secondary)]">Veicoli in DB</div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">{vehiclesCount}</div>
          </div>
          <div className="rounded-md border border-[var(--color-border-tertiary)] px-3 py-2">
            <div className="text-[11px] text-[var(--color-text-secondary)]">Sessioni in DB</div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">{sessionsCount}</div>
          </div>
          <div className="rounded-md border border-[var(--color-border-tertiary)] px-3 py-2">
            <div className="text-[11px] text-[var(--color-text-secondary)]">Comandi pendenti</div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">{pendingCommands}</div>
          </div>
          <div className="rounded-md border border-[var(--color-border-tertiary)] px-3 py-2">
            <div className="text-[11px] text-[var(--color-text-secondary)]">Eventi update (24h)</div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">{updateEvents24h}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Funzioni backend realmente presenti">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border-tertiary)] text-left text-[11px] text-[var(--color-text-secondary)]">
                <th className="px-2 py-2">Area</th>
                <th className="px-2 py-2">Endpoint</th>
                <th className="px-2 py-2">Metodi</th>
                <th className="px-2 py-2">Usato da</th>
                <th className="px-2 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {API_ROWS.map((row) => (
                <tr key={row.endpoint} className="border-b border-[var(--color-border-tertiary)] align-top">
                  <td className="px-2 py-2 font-medium text-[var(--color-text-primary)]">{row.area}</td>
                  <td className="px-2 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">{row.endpoint}</td>
                  <td className="px-2 py-2 text-[var(--color-text-primary)]">{row.methods}</td>
                  <td className="px-2 py-2 text-[var(--color-text-primary)]">{row.usedBy}</td>
                  <td className="px-2 py-2 text-[var(--color-text-secondary)]">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Protocolli dispositivi (firmware)">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border-tertiary)] text-left text-[11px] text-[var(--color-text-secondary)]">
                <th className="px-2 py-2">Protocollo</th>
                <th className="px-2 py-2">Formato</th>
                <th className="px-2 py-2">Implementazione attuale</th>
              </tr>
            </thead>
            <tbody>
              {DEVICE_PROTOCOL_ROWS.map((row) => (
                <tr key={row.protocol} className="border-b border-[var(--color-border-tertiary)] align-top">
                  <td className="px-2 py-2 font-medium text-[var(--color-text-primary)]">{row.protocol}</td>
                  <td className="px-2 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">{row.shape}</td>
                  <td className="px-2 py-2 text-[var(--color-text-primary)]">{row.implemented}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ControlPlanePanel />
    </div>
  );
}
