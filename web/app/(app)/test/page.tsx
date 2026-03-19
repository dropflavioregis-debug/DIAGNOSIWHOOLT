"use client";

import { useState } from "react";
import { SectionCard } from "@/components/common/SectionCard";

type TestResult = {
  ok: boolean;
  message: string;
  detail?: string;
};

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  if (diffM < 1) return "pochi secondi fa";
  if (diffM < 60) return `${diffM} minuti fa`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH} ore fa`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} giorni fa`;
}

export default function TestPage() {
  const [dbResult, setDbResult] = useState<TestResult | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [esp32Result, setEsp32Result] = useState<TestResult | null>(null);
  const [esp32Loading, setEsp32Loading] = useState(false);
  const [lastSeenResult, setLastSeenResult] = useState<{
    ok: boolean;
    device_id: string | null;
    started_at: string | null;
    message: string;
  } | null>(null);
  const [lastSeenLoading, setLastSeenLoading] = useState(false);
  const [lanIp, setLanIp] = useState("");
  const [lanResult, setLanResult] = useState<TestResult | null>(null);
  const [lanLoading, setLanLoading] = useState(false);

  const testDatabase = async () => {
    setDbLoading(true);
    setDbResult(null);
    try {
      const res = await fetch("/api/test/db");
      const data = (await res.json()) as TestResult;
      setDbResult(data);
    } catch {
      setDbResult({ ok: false, message: "Errore di connessione (rete o CORS)." });
    } finally {
      setDbLoading(false);
    }
  };

  const testEsp32 = async () => {
    setEsp32Loading(true);
    setEsp32Result(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: "test-dashboard",
          raw_dtc: [],
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      const ok = res.ok && data.ok !== false;
      setEsp32Result({
        ok,
        message: ok ? "Endpoint ingest raggiungibile" : "Errore",
        detail: data.message ?? data.error ?? (ok ? "L’ESP32 può inviare dati a questo URL." : undefined),
      });
    } catch {
      setEsp32Result({ ok: false, message: "Errore di connessione (rete o CORS)." });
    } finally {
      setEsp32Loading(false);
    }
  };

  const testDeviceLastSeen = async () => {
    setLastSeenLoading(true);
    setLastSeenResult(null);
    try {
      const res = await fetch("/api/test/device-last-seen");
      const data = (await res.json()) as {
        ok: boolean;
        device_id: string | null;
        started_at: string | null;
        message: string;
      };
      setLastSeenResult(data);
    } catch {
      setLastSeenResult({
        ok: false,
        device_id: null,
        started_at: null,
        message: "Errore di connessione",
      });
    } finally {
      setLastSeenLoading(false);
    }
  };

  const testDeviceLan = async () => {
    const ip = lanIp.trim().replace(/^https?:\/\//, "").split("/")[0];
    if (!ip) {
      setLanResult({ ok: false, message: "Inserisci l’IP del dispositivo (es. 192.168.1.100)" });
      return;
    }
    setLanLoading(true);
    setLanResult(null);
    const url = `http://${ip}/`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setLanResult({
        ok: res.ok || res.status === 200 || res.status === 302,
        message: res.ok ? "Dispositivo raggiungibile in rete locale" : "Dispositivo risponde ma con status " + res.status,
        detail: `Risposta da ${ip} (${res.status})`,
      });
    } catch (e) {
      clearTimeout(timeout);
      const msg = e instanceof Error ? e.message : "Errore";
      const isNetwork = msg.includes("Failed to fetch") || msg.includes("Load failed") || msg.includes("abort");
      setLanResult({
        ok: false,
        message: "Non raggiungibile",
        detail: isNetwork
          ? "Rete non raggiungibile (stessa WiFi? IP corretto?). Da HTTPS (Vercel) il browser blocca l’accesso a HTTP: usa sviluppo locale (localhost) per questo test."
          : msg,
      });
    } finally {
      setLanLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-[var(--color-text-primary)]">Test connessioni</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Verifica connessione database (Supabase) e raggiungibilità dell’endpoint per l’ESP32
        </p>
      </div>

      <SectionCard title="Test connessione database">
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          Controlla che le variabili Supabase siano configurate e che il database risponda.
        </p>
        <button
          type="button"
          onClick={testDatabase}
          disabled={dbLoading}
          className="rounded-md border border-[var(--color-border-secondary)] bg-transparent px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-secondary)] disabled:opacity-50"
        >
          {dbLoading ? "Test in corso…" : "Test connessione database"}
        </button>
        {dbResult && (
          <div
            className="mt-3 rounded-md px-3 py-2.5 text-xs"
            style={{
              background: dbResult.ok ? "var(--green-50)" : "var(--red-50)",
              color: dbResult.ok ? "var(--green-800)" : "var(--red-800)",
            }}
          >
            <p className="font-medium">{dbResult.ok ? "OK" : "Errore"}</p>
            <p className="mt-0.5">{dbResult.message}</p>
            {dbResult.detail && <p className="mt-1 text-[11px] opacity-90">{dbResult.detail}</p>}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Test connessione ESP32">
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          Verifica che l’endpoint <code className="rounded bg-[var(--color-background-secondary)] px-1">/api/ingest</code> sia
          raggiungibile (come quando l’ESP32 invia dati). Viene inviata una richiesta di test senza salvare dati reali.
        </p>
        <button
          type="button"
          onClick={testEsp32}
          disabled={esp32Loading}
          className="rounded-md border border-[var(--color-border-secondary)] bg-transparent px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-secondary)] disabled:opacity-50"
        >
          {esp32Loading ? "Test in corso…" : "Test connessione ESP32"}
        </button>
        {esp32Result && (
          <div
            className="mt-3 rounded-md px-3 py-2.5 text-xs"
            style={{
              background: esp32Result.ok ? "var(--green-50)" : "var(--red-50)",
              color: esp32Result.ok ? "var(--green-800)" : "var(--red-800)",
            }}
          >
            <p className="font-medium">{esp32Result.ok ? "OK" : "Errore"}</p>
            <p className="mt-0.5">{esp32Result.message}</p>
            {esp32Result.detail && <p className="mt-1 text-[11px] opacity-90">{esp32Result.detail}</p>}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Stato dispositivi (WiFi)">
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          Verifica se almeno un ESP32 è stato in rete e ha inviato dati al server (ultima sessione ricevuta).
        </p>
        <button
          type="button"
          onClick={testDeviceLastSeen}
          disabled={lastSeenLoading}
          className="rounded-md border border-[var(--color-border-secondary)] bg-transparent px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-secondary)] disabled:opacity-50"
        >
          {lastSeenLoading ? "Verifica…" : "Verifica ultimo dato ricevuto"}
        </button>
        {lastSeenResult && (
          <div
            className="mt-3 rounded-md px-3 py-2.5 text-xs"
            style={{
              background: lastSeenResult.ok && lastSeenResult.started_at ? "var(--green-50)" : "var(--color-background-secondary)",
              color: lastSeenResult.ok && lastSeenResult.started_at ? "var(--green-800)" : "var(--color-text-secondary)",
            }}
          >
            <p className="font-medium">
              {lastSeenResult.ok && lastSeenResult.started_at ? "Dispositivo visto" : lastSeenResult.ok ? "Nessun dato" : "Errore"}
            </p>
            <p className="mt-0.5">{lastSeenResult.message}</p>
            {lastSeenResult.started_at && (
              <p className="mt-1 text-[11px] opacity-90">
                {lastSeenResult.device_id} — {formatTimeAgo(lastSeenResult.started_at)}
              </p>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Dispositivo in rete locale">
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          Se sei sulla stessa rete WiFi dell’ESP32, inserisci il suo IP (es. 192.168.1.100) per verificare che risponda. Da sito in HTTPS (Vercel) il browser può bloccare l’accesso; funziona da sviluppo locale (localhost).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={lanIp}
            onChange={(e) => setLanIp(e.target.value)}
            placeholder="192.168.1.100"
            className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] w-40"
          />
          <button
            type="button"
            onClick={testDeviceLan}
            disabled={lanLoading}
            className="rounded-md border border-[var(--color-border-secondary)] bg-transparent px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-secondary)] disabled:opacity-50"
          >
            {lanLoading ? "Verifica…" : "Verifica raggiungibilità"}
          </button>
        </div>
        {lanResult && (
          <div
            className="mt-3 rounded-md px-3 py-2.5 text-xs"
            style={{
              background: lanResult.ok ? "var(--green-50)" : "var(--red-50)",
              color: lanResult.ok ? "var(--green-800)" : "var(--red-800)",
            }}
          >
            <p className="font-medium">{lanResult.ok ? "OK" : "Non raggiungibile"}</p>
            <p className="mt-0.5">{lanResult.message}</p>
            {lanResult.detail && <p className="mt-1 text-[11px] opacity-90">{lanResult.detail}</p>}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
