"use client";

import { useMemo, useState } from "react";
import type { VehicleConnectionStatus } from "@/lib/types";
import {
  queueDashboardCommand,
  setDashboardSniffer,
  setDashboardCanBitrate,
  runDashboardCanProbe,
  runDashboardCanSweep,
} from "@/app/actions/dashboard-operations";

interface LiveOperationsPanelProps {
  connectionStatus: VehicleConnectionStatus;
  hasActiveSession: boolean;
  deviceId: string | null;
  deviceIds: string[];
}

export function LiveOperationsPanel({
  connectionStatus,
  hasActiveSession,
  deviceId,
  deviceIds,
}: LiveOperationsPanelProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(deviceId ?? deviceIds[0] ?? "");
  const [snifferWantedOn, setSnifferWantedOn] = useState<boolean>(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canBitrateKbps, setCanBitrateKbps] = useState<125 | 250 | 500 | 1000>(500);

  const effectiveDeviceId = useMemo(() => {
    const direct = (deviceId ?? "").trim();
    if (direct) return direct;
    const selected = selectedDeviceId.trim();
    if (selected) return selected;
    return "";
  }, [deviceId, selectedDeviceId]);

  const isConnected = connectionStatus === "live" || connectionStatus === "pending";
  const canRunCommands = effectiveDeviceId.length > 0;

  async function runAction(
    actionKey: string,
    action: () => Promise<{ ok: boolean; error?: string; message?: string }>,
    onSuccess?: () => void
  ) {
    setBusyAction(actionKey);
    setError(null);
    setMessage(null);
    try {
      const res = await action();
      if (res.ok) {
        onSuccess?.();
        setMessage(res.message ?? "Comando inviato con successo.");
      } else {
        setError(res.error ?? "Errore invio comando.");
      }
    } catch {
      setError("Errore di rete.");
    } finally {
      setBusyAction(null);
    }
  }

  if (!canRunCommands) {
    return (
      <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
        Nessun dispositivo disponibile. Collega l&apos;ESP32 e attendi la prima sessione per abilitare i comandi live.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {!deviceId && deviceIds.length > 0 && (
          <>
            <label className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
              Dispositivo:
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="rounded-[var(--border-radius-md)] border px-2 py-1.5 text-[12px] bg-[var(--color-background-secondary)]"
              style={{ borderColor: "var(--color-border-secondary)", color: "var(--color-text-primary)" }}
            >
              {deviceIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </>
        )}
        <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
          Stato:{" "}
          {connectionStatus === "live"
            ? "Connesso - dati in arrivo"
            : connectionStatus === "pending"
              ? "Connesso - attesa dati"
              : connectionStatus === "offline"
                ? "Offline"
                : "Nessuna sessione"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!hasActiveSession ? (
          <button
            type="button"
            disabled={busyAction !== null || !isConnected}
            onClick={() =>
              runAction("start_session", () =>
                queueDashboardCommand(effectiveDeviceId, "start_session")
              )
            }
            className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors disabled:opacity-50"
            style={{
              borderColor: "var(--color-border-info)",
              background: "var(--color-background-info)",
              color: "var(--color-text-info)",
            }}
          >
            {busyAction === "start_session" ? "Invio..." : "Avvia sessione diagnosi"}
          </button>
        ) : (
          <span className="text-[12px]" style={{ color: "var(--teal-500)" }}>
            Sessione attiva rilevata: diagnostica in corso.
          </span>
        )}

        <button
          type="button"
          disabled={busyAction !== null || !isConnected}
          onClick={() =>
            runAction("read_vin", () => queueDashboardCommand(effectiveDeviceId, "read_vin"))
          }
          className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors disabled:opacity-50"
          style={{
            borderColor: "var(--color-border-secondary)",
            background: "var(--color-background-tertiary)",
            color: "var(--color-text-primary)",
          }}
        >
          {busyAction === "read_vin" ? "Invio..." : "Leggi VIN ora"}
        </button>

        <button
          type="button"
          disabled={busyAction !== null || !isConnected}
          onClick={() =>
            runAction("read_dtc", () => queueDashboardCommand(effectiveDeviceId, "read_dtc"))
          }
          className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors disabled:opacity-50"
          style={{
            borderColor: "var(--color-border-secondary)",
            background: "var(--color-background-tertiary)",
            color: "var(--color-text-primary)",
          }}
        >
          {busyAction === "read_dtc" ? "Invio..." : "Leggi DTC ora"}
        </button>

        <button
          type="button"
          disabled={busyAction !== null || !isConnected}
          onClick={() =>
            runAction(
              "sniffer",
              () => setDashboardSniffer(effectiveDeviceId, !snifferWantedOn),
              () => setSnifferWantedOn((prev) => !prev)
            )
          }
          className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors disabled:opacity-50"
          style={{
            borderColor: snifferWantedOn ? "var(--color-border-danger)" : "var(--color-border-secondary)",
            background: snifferWantedOn ? "var(--color-background-danger)" : "var(--color-background-tertiary)",
            color: snifferWantedOn ? "var(--color-text-inverse)" : "var(--color-text-primary)",
          }}
        >
          {busyAction === "sniffer"
            ? "Invio..."
            : snifferWantedOn
              ? "Disattiva CAN Sniffer"
              : "Attiva CAN Sniffer"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
          CAN bitrate:
        </label>
        <select
          value={canBitrateKbps}
          onChange={(e) => setCanBitrateKbps(Number(e.target.value) as 125 | 250 | 500 | 1000)}
          className="rounded-[var(--border-radius-md)] border px-2 py-1.5 text-[12px] bg-[var(--color-background-secondary)]"
          style={{ borderColor: "var(--color-border-secondary)", color: "var(--color-text-primary)" }}
        >
          <option value={125}>125 kbps</option>
          <option value={250}>250 kbps</option>
          <option value={500}>500 kbps</option>
          <option value={1000}>1000 kbps</option>
        </select>

        <button
          type="button"
          disabled={busyAction !== null || !isConnected}
          onClick={() =>
            runAction("set_can_bitrate", () => setDashboardCanBitrate(effectiveDeviceId, canBitrateKbps))
          }
          className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors disabled:opacity-50"
          style={{
            borderColor: "var(--color-border-secondary)",
            background: "var(--color-background-tertiary)",
            color: "var(--color-text-primary)",
          }}
        >
          {busyAction === "set_can_bitrate" ? "Invio..." : "Applica bitrate"}
        </button>

        <button
          type="button"
          disabled={busyAction !== null || !isConnected}
          onClick={() =>
            runAction("can_probe", () =>
              runDashboardCanProbe(effectiveDeviceId, 2000, canBitrateKbps)
            )
          }
          className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors disabled:opacity-50"
          style={{
            borderColor: "var(--color-border-secondary)",
            background: "var(--color-background-tertiary)",
            color: "var(--color-text-primary)",
          }}
        >
          {busyAction === "can_probe" ? "Invio..." : "Probe CAN 2s"}
        </button>

        <button
          type="button"
          disabled={busyAction !== null || !isConnected}
          onClick={() =>
            runAction("can_sweep", () => runDashboardCanSweep(effectiveDeviceId, 1200))
          }
          className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors disabled:opacity-50"
          style={{
            borderColor: "var(--color-border-secondary)",
            background: "var(--color-background-tertiary)",
            color: "var(--color-text-primary)",
          }}
        >
          {busyAction === "can_sweep" ? "Invio..." : "Sweep bitrate"}
        </button>
      </div>

      <p className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
        I comandi vengono eseguiti dal firmware ESP32 al prossimo polling (circa 5 s); i dati si aggiornano automaticamente in dashboard.
      </p>
      {message && (
        <p className="text-[11px]" style={{ color: "var(--teal-600)" }}>
          {message}
        </p>
      )}
      {error && (
        <p className="text-[11px]" style={{ color: "var(--color-text-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
