"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  subscribeSniffer,
  unsubscribeSniffer,
  getCanSnifferFrames,
  importCanSnifferFrames,
} from "@/app/actions/can-sniffer";
import type { CanFrame } from "@/lib/can-sniffer-frames-store";
import {
  parseSavvyCanNativeCsv,
  exportToSavvyCanNativeCsv,
  type CanFrameForCsv,
} from "@/lib/savvycan-csv";
import { EmptyState } from "@/components/common/EmptyState";

const POLL_INTERVAL_MS = 1000;
const MAX_LIST_FRAMES = 200;

interface CanSnifferPanelProps {
  deviceId: string | null;
  /** Lista device_id da sessioni (per selezionare dispositivo quando non c’è sessione attiva). */
  deviceIds?: string[];
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  } catch {
    return iso;
  }
}

function frameToLine(f: CanFrame): string {
  const ts = f.ts ?? new Date().toISOString();
  const idHex = "0x" + f.id.toString(16).toUpperCase().padStart(f.id > 0xFFF ? 4 : 3, "0");
  const dataHex = (f.data ?? [])
    .slice(0, f.len)
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
  return `${ts}\t${idHex}\t${dataHex}`;
}

export function CanSnifferPanel({ deviceId: propDeviceId, deviceIds = [] }: CanSnifferPanelProps) {
  const [snifferOn, setSnifferOn] = useState(false);
  const [frames, setFrames] = useState<CanFrame[]>([]);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<CanFrame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const recordedRef = useRef<CanFrame[]>([]);
  const lastRecordedTsRef = useRef<string>("");

  const deviceId = propDeviceId?.trim() || selectedDeviceId.trim() || null;

  const fetchFrames = useCallback(async () => {
    if (!deviceId) return;
    const res = await getCanSnifferFrames(deviceId.trim(), MAX_LIST_FRAMES);
    if (res.ok && Array.isArray(res.frames)) {
      setFrames(res.frames);
      if (recording && res.frames.length > 0) {
        const lastTs = lastRecordedTsRef.current;
        const newOnes = res.frames.filter((f) => (f.ts ?? "") > lastTs);
        if (newOnes.length > 0) {
          const maxTs = newOnes.reduce((acc, f) => ((f.ts ?? "") > acc ? (f.ts ?? "") : acc), lastTs);
          lastRecordedTsRef.current = maxTs;
          recordedRef.current = [...recordedRef.current, ...newOnes];
          setRecorded([...recordedRef.current]);
        }
      }
    }
  }, [deviceId, recording]);

  useEffect(() => {
    if (deviceIds.length > 0 && !selectedDeviceId) setSelectedDeviceId(deviceIds[0] ?? "");
  }, [deviceIds, selectedDeviceId]);

  useEffect(() => {
    if (!snifferOn || !deviceId) return;
    const t = setInterval(fetchFrames, POLL_INTERVAL_MS);
    fetchFrames();
    return () => clearInterval(t);
  }, [snifferOn, deviceId, fetchFrames]);

  async function handleToggleSniffer() {
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    try {
      if (snifferOn) {
        const res = await unsubscribeSniffer(deviceId);
        if (res.ok) setSnifferOn(false);
        else setError(res.error ?? "Errore");
      } else {
        const res = await subscribeSniffer(deviceId);
        if (res.ok) setSnifferOn(true);
        else setError(res.error ?? "Errore");
      }
    } catch {
      setError("Errore di rete");
    } finally {
      setLoading(false);
    }
  }

  function handleToggleRecord() {
    if (recording) {
      setRecording(false);
    } else {
      recordedRef.current = [];
      lastRecordedTsRef.current = "";
      setRecorded([]);
      setRecording(true);
    }
  }

  function handleExportTxt() {
    const lines = recordedRef.current.length
      ? recordedRef.current.map(frameToLine)
      : frames.map(frameToLine);
    const header = "timestamp\tCAN ID\tdata (hex)\n";
    const body = lines.join("\n");
    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `can-sniffer-${deviceId ?? "export"}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function framesToCsvFormat(list: CanFrame[]): CanFrameForCsv[] {
    return list.map((f, i) => ({
      id: f.id,
      len: f.len,
      data: f.data ?? [],
      tsMicros: f.ts ? Math.floor(new Date(f.ts).getTime() * 1000) : undefined,
    }));
  }

  function handleExportCsv() {
    const list = recordedRef.current.length ? recordedRef.current : frames;
    const csvFrames = framesToCsvFormat(list);
    const csv = exportToSavvyCanNativeCsv(csvFrames);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `can-sniffer-${deviceId ?? "export"}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !deviceId?.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseSavvyCanNativeCsv(text);
      if (parsed.length === 0) {
        setError("Nessun frame valido nel file (formato SavvyCAN/GVRET CSV)");
        return;
      }
      const res = await importCanSnifferFrames(deviceId.trim(), parsed);
      if (res.ok && res.count != null) {
        await fetchFrames();
        setError(null);
        setLoading(false);
        return;
      }
      setError(res.error ?? "Import fallito");
    } catch {
      setError("Errore lettura file");
    } finally {
      setLoading(false);
    }
  }

  if (!deviceId?.trim()) {
    return (
      <EmptyState
        title="CAN Sniffer"
        description="Seleziona un dispositivo (sessione attiva) per avviare il CAN Sniffer."
      />
    );
  }

  const displayFrames = frames.slice(-MAX_LIST_FRAMES);

  return (
    <div className="flex flex-col gap-3">
      {!propDeviceId && deviceIds.length > 0 && (
        <div className="flex items-center gap-2">
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
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleToggleSniffer}
          disabled={loading || !deviceId}
          className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors disabled:opacity-50"
          style={{
            borderColor: snifferOn ? "var(--color-border-danger)" : "var(--color-border-secondary)",
            background: snifferOn ? "transparent" : "var(--color-background-tertiary)",
            color: snifferOn ? "var(--color-text-danger)" : "var(--color-text-primary)",
          }}
        >
          {snifferOn ? "Ferma CAN Sniffer" : "Avvia CAN Sniffer"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleImportCsv}
          aria-label="Importa log CSV"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors disabled:opacity-50"
          style={{
            borderColor: "var(--color-border-secondary)",
            background: "var(--color-background-tertiary)",
            color: "var(--color-text-primary)",
          }}
        >
          Importa log CSV
        </button>
        {snifferOn && (
          <>
            <button
              type="button"
              onClick={handleToggleRecord}
              className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors"
              style={{
                borderColor: recording ? "var(--color-border-danger)" : "var(--color-border-secondary)",
                background: recording ? "var(--color-background-danger)" : "var(--color-background-tertiary)",
                color: recording ? "var(--color-text-inverse)" : "var(--color-text-primary)",
              }}
            >
              {recording ? "Ferma registrazione" : "Avvia registrazione"}
            </button>
            <button
              type="button"
              onClick={handleExportTxt}
              className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors"
              style={{
                borderColor: "var(--color-border-secondary)",
                background: "var(--color-background-tertiary)",
                color: "var(--color-text-primary)",
              }}
            >
              Esporta in TXT
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="text-[12px] font-medium px-3 py-1.5 rounded-[var(--border-radius-md)] border transition-colors"
              style={{
                borderColor: "var(--color-border-secondary)",
                background: "var(--color-background-tertiary)",
                color: "var(--color-text-primary)",
              }}
            >
              Esporta in CSV (SavvyCAN)
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="text-[12px]" style={{ color: "var(--color-text-danger)" }}>
          {error}
        </p>
      )}
      {snifferOn && (
        <div
          className="rounded-[var(--border-radius-md)] overflow-auto font-mono text-[11px]"
          style={{
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            maxHeight: "280px",
          }}
        >
          {displayFrames.length === 0 ? (
            <div className="py-4 px-3" style={{ color: "var(--color-text-secondary)" }}>
              In attesa di frame CAN… (il dispositivo invia quando il bus è attivo)
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                  <th className="text-left py-1.5 px-2" style={{ color: "var(--color-text-secondary)" }}>
                    Ora
                  </th>
                  <th className="text-left py-1.5 px-2" style={{ color: "var(--color-text-secondary)" }}>
                    ID
                  </th>
                  <th className="text-left py-1.5 px-2" style={{ color: "var(--color-text-secondary)" }}>
                    Dati (hex)
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayFrames.map((f, i) => (
                  <tr
                    key={`${f.ts}-${f.id}-${i}`}
                    style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}
                  >
                    <td className="py-1 px-2" style={{ color: "var(--color-text-secondary)" }}>
                      {formatTs(f.ts)}
                    </td>
                    <td className="py-1 px-2" style={{ color: "var(--color-text-info)" }}>
                      0x{f.id.toString(16).toUpperCase().padStart(f.id > 0xfff ? 4 : 3, "0")}
                    </td>
                    <td className="py-1 px-2" style={{ color: "var(--color-text-primary)" }}>
                      {(f.data ?? [])
                        .slice(0, f.len)
                        .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
                        .join(" ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {recording && (
        <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
          Registrazione attiva: {recorded.length} frame salvati
        </p>
      )}
    </div>
  );
}
