import { getSupabase } from "@/lib/supabase";
import type {
  VehicleInfo,
  VehicleConnectionStatus,
  DTCItem,
  AIMessage,
  MetricItem,
} from "@/lib/types";
import { getBatteryMetrics } from "@/lib/battery-utils";
import type { BatteryReading } from "@/lib/types";
import { MetricCard } from "@/components/common/MetricCard";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DTCListCompact } from "@/components/dashboard/DTCListCompact";
import { AIPanel } from "@/components/dashboard/AIPanel";
import { CanSnifferPanel } from "@/components/dashboard/CanSnifferPanel";
import { CellGrid } from "@/components/battery/CellGrid";
import { EmptyState } from "@/components/common/EmptyState";
import { RefreshButton } from "@/components/dashboard/RefreshButton";
import { LiveVehicleStrip } from "@/components/dashboard/LiveVehicleStrip";
import { DashboardAutoRefresh } from "@/components/dashboard/DashboardAutoRefresh";
import { LiveOperationsPanel } from "@/components/dashboard/LiveOperationsPanel";
import {
  fetchLastDataAtForSession,
  formatLastDataItaliano,
  resolveConnectionStatus,
} from "@/lib/dashboard-live";

type SessionRow = {
  id: string;
  device_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
  raw_dtc: string[] | null;
  ai_diagnosis: string | null;
  vin: string | null;
  vin_decoded: { make?: string; model?: string; year?: number } | null;
  vehicles: { make: string; model: string } | { make: string; model: string }[] | null;
};

function buildVehicleInfo(
  session: SessionRow | null,
  connectionStatus: VehicleConnectionStatus,
  lastDataAt: Date | null
): VehicleInfo {
  if (!session) {
    return {
      name: "Nessun veicolo connesso",
      meta: "Connetti un dispositivo e avvia una sessione",
      connected: false,
      connectionStatus: "none",
    };
  }
  const decoded = session.vin_decoded;
  const v = session.vehicles;
  const vehicle = Array.isArray(v) ? v[0] : v;
  const name = decoded?.make && decoded?.model
    ? `${decoded.make} ${decoded.model}${decoded.year ? ` (${decoded.year})` : ""}`
    : vehicle
      ? `${vehicle.make} ${vehicle.model}`
      : session.device_id;
  const live = connectionStatus === "live";
  let liveSubtitle: string | undefined;
  if (lastDataAt) {
    liveSubtitle = `Ultimo dato: ${formatLastDataItaliano(lastDataAt)}`;
  } else if (connectionStatus === "pending") {
    liveSubtitle = "In attesa del primo dato dal dispositivo…";
  } else if (connectionStatus === "offline") {
    liveSubtitle = "Nessun dato negli ultimi 60 s (veicolo o bus CAN inattivo)";
  }
  return {
    name,
    meta: `Sessione ${session.id.slice(0, 8)} · ${session.started_at ? new Date(session.started_at).toLocaleString("it-IT") : "—"}`,
    ...(liveSubtitle && { liveSubtitle }),
    connected: live,
    connectionStatus,
    ...(session.vin && { vin: session.vin }),
    ...(decoded && { vinDecoded: { make: decoded.make, model: decoded.model, year: decoded.year } }),
  };
}

function mapDtcRowToItem(
  code: string,
  row: { description_it?: string; description_en?: string; severity?: string; system?: string } | null
): DTCItem {
  const desc = row?.description_it ?? row?.description_en ?? "—";
  const severity = (row?.severity === "critical" || row?.severity === "warning" || row?.severity === "info"
    ? row.severity
    : "info") as DTCItem["severity"];
  return {
    code,
    name: code,
    description: desc,
    severity,
    type: "active",
    system: row?.system ?? undefined,
  };
}

export default async function DashboardPage() {
  const supabase = getSupabase();
  let session: SessionRow | null = null;
  let lastDataAt: Date | null = null;
  let dtcItems: DTCItem[] = [];
  let batteryReading: BatteryReading | null = null;
  let dashboardMetrics: MetricItem[] = [];
  let aiMessages: AIMessage[] = [];
  let deviceIds: string[] = [];

  if (supabase) {
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("id, device_id, vehicle_id, started_at, ended_at, raw_dtc, ai_diagnosis, vin, vin_decoded, vehicles(make, model)")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: sessionsForDevices } = await supabase
      .from("sessions")
      .select("device_id")
      .order("started_at", { ascending: false })
      .limit(100);
    const seen = new Set<string>();
    for (const s of sessionsForDevices ?? []) {
      const id = (s as { device_id?: string }).device_id?.trim();
      if (id && !seen.has(id)) {
        seen.add(id);
        deviceIds.push(id);
      }
    }

    if (sessionData) {
      session = sessionData as unknown as SessionRow;
      lastDataAt = await fetchLastDataAtForSession(supabase, session.id, session.device_id);

      const rawDtc = session.raw_dtc ?? [];
      if (rawDtc.length > 0 && session.vehicle_id) {
        const { data: dtcRows } = await supabase
          .from("dtc")
          .select("code, description_it, description_en, severity, system")
          .in("code", rawDtc)
          .eq("vehicle_id", session.vehicle_id);
        const byCode = new Map(
          (dtcRows ?? []).map((r) => [r.code, r])
        );
        dtcItems = rawDtc.map((code) => mapDtcRowToItem(code, byCode.get(code) ?? null));
      } else if (rawDtc.length > 0) {
        dtcItems = rawDtc.map((code) => mapDtcRowToItem(code, null));
      }

      if (session.ai_diagnosis) {
        aiMessages = [
          { title: "Diagnosi AI", body: session.ai_diagnosis, borderColor: "var(--blue-400)" },
        ];
      }

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
          if (name && typeof (r as { value?: number }).value === "number" && !byName.has(name)) {
            byName.set(name, (r as { value: number }).value);
          }
        }
        const soc = byName.get("SOC") ?? byName.get("soc") ?? 0;
        const soh = byName.get("SOH") ?? byName.get("soh") ?? 0;
        const packV = byName.get("PackVoltage") ?? byName.get("pack_voltage") ?? 0;
        const cellTemps = readings
          .filter((r) => (r.signals as { name?: string } | null)?.name?.toLowerCase().includes("cell") || (r.signals as { name?: string } | null)?.name?.toLowerCase().includes("temp"))
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
          cellTemps: temps.length ? temps : Array(96).fill(0),
        };
        dashboardMetrics = getBatteryMetrics(batteryReading);
      }
    }
  }

  const connectionStatus: VehicleConnectionStatus = session
    ? resolveConnectionStatus({ started_at: session.started_at }, lastDataAt, Date.now())
    : "none";
  const vehicle = buildVehicleInfo(session, connectionStatus, lastDataAt);
  const hasData = session !== null;
  const hasActiveSession = Boolean(session && !session.ended_at);

  return (
    <div>
      <DashboardAutoRefresh />
      <LiveVehicleStrip initialVehicle={vehicle} />

      <div
        className="flex items-center justify-between"
        style={{ marginBottom: "20px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <h1
            className="text-[16px] font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            Dashboard diagnostica
          </h1>
          <p
            className="text-[12px]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {hasData && session ? `Ultima sessione: ${new Date(session.started_at).toLocaleString("it-IT")}` : "Nessuna sessione"}
          </p>
        </div>
        <div className="flex items-center" style={{ gap: "8px" }}>
          {dtcItems.length > 0 && (
            <StatusBadge variant="amber">{dtcItems.length} DTC attivi</StatusBadge>
          )}
          <RefreshButton />
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          title="Nessun dato disponibile"
          description="Connetti un veicolo e avvia una sessione diagnostica per vedere metriche, DTC e analisi."
        />
      ) : (
        <>
          <SectionCard title="Operazioni live" action={null}>
            <LiveOperationsPanel
              connectionStatus={connectionStatus}
              hasActiveSession={hasActiveSession}
              deviceId={session?.device_id ?? null}
              deviceIds={deviceIds}
            />
          </SectionCard>

          {dashboardMetrics.length > 0 && (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
              style={{ gap: "10px", marginBottom: "20px", marginTop: "16px" }}
            >
              {dashboardMetrics.map((m) => (
                <MetricCard key={m.label} item={m} />
              ))}
            </div>
          )}

          <div
            className="grid grid-cols-1 lg:grid-cols-[1fr_320px]"
            style={{ gap: "16px", marginBottom: "16px" }}
          >
            <SectionCard
              title="Codici errore attivi"
              action={
                <button
                  type="button"
                  disabled
                  title="Cancellazione DTC dal veicolo non disponibile da dashboard"
                  className="text-[11px] cursor-not-allowed opacity-60"
                  style={{ color: "var(--color-text-info)" }}
                >
                  Cancella tutti
                </button>
              }
            >
              {dtcItems.length > 0 ? (
                <>
                  <DTCListCompact items={dtcItems} activeCount={dtcItems.length} />
                  {batteryReading && batteryReading.cellTemps.length > 0 && (
                    <div style={{ marginTop: "16px" }}>
                      <div
                        className="flex items-center justify-between"
                        style={{ marginBottom: "8px" }}
                      >
                        <span
                          className="text-[13px] font-medium"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          Temperatura celle ({batteryReading.cellTemps.length} celle)
                        </span>
                      </div>
                      <CellGrid cellTemps={batteryReading.cellTemps} columns={8} />
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  title="Nessun DTC"
                  description="Nessun codice errore in questa sessione."
                />
              )}
            </SectionCard>

            <SectionCard
              title="Analisi AI"
              action={<StatusBadge variant="green">Claude</StatusBadge>}
            >
              {aiMessages.length > 0 ? (
                <AIPanel messages={aiMessages} sessionId={session?.id ?? null} />
              ) : (
                <EmptyState
                  title="Nessuna analisi AI"
                  description="L'analisi verrà mostrata qui dopo l'elaborazione."
                />
              )}
            </SectionCard>
          </div>

          <SectionCard title="CAN Sniffer" action={null}>
            <CanSnifferPanel
              deviceId={session?.device_id ?? null}
              deviceIds={deviceIds}
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}
