"use client";

import { useState, useEffect } from "react";
import { SectionCard } from "@/components/common/SectionCard";
import { CanSnifferPanel } from "@/components/dashboard/CanSnifferPanel";

export default function DevicePage() {
  const [origin, setOrigin] = useState("");
  const [monitorDeviceId, setMonitorDeviceId] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const copyUrl = () => {
    if (origin) {
      void navigator.clipboard.writeText(origin);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-[var(--color-text-primary)]">Dispositivo</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">ESP32-S3 — WiFi, CAN, OTA</p>
      </div>

      <SectionCard title="Come configurare l’ESP32">
        <p className="text-xs text-[var(--color-text-secondary)] mb-4">
          La configurazione (WiFi, URL server, API key) si fa <strong className="text-[var(--color-text-primary)]">sul dispositivo</strong> (captive portal). Da qui invece puoi inviare comandi all’ESP32 tramite database: <strong className="text-[var(--color-text-primary)]">Avvia sessione</strong> (pagina Sessioni) e <strong className="text-[var(--color-text-primary)]">CAN Sniffer</strong> (dashboard). L’ESP32 riceve i comandi al prossimo poll senza bisogno di riprogrammarlo.
        </p>
        <ol className="list-decimal list-inside text-xs text-[var(--color-text-secondary)] space-y-2 mb-4">
          <li>Alla prima accensione senza WiFi, l’ESP32 crea l’hotspot <strong className="text-[var(--color-text-primary)]">EV-Diagnostic-XXXX</strong> (XXXX = ultimi 4 caratteri del MAC).</li>
          <li>Connetti telefono o PC a quel WiFi.</li>
          <li>Apri il browser su <strong className="text-[var(--color-text-primary)]">http://192.168.4.1</strong>.</li>
          <li>Nel form inserisci: SSID e password della tua rete, URL server (vedi sotto), API key (quella impostata in Vercel), nome dispositivo.</li>
          <li>Clicca Salva → l’ESP32 si riavvia e si connette.</li>
        </ol>
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          Per riconfigurare in seguito: quando l’ESP32 è connesso al WiFi, nella documentazione firmware è indicato come aprire la pagina di riconfigurazione (di solito un URL locale sul dispositivo).
        </p>
      </SectionCard>

      <SectionCard title="URL da usare sul dispositivo">
        <p className="text-[11px] text-[var(--color-text-secondary)] mb-2">
          Copia questo URL e incollalo nel form su 192.168.4.1 nel campo «URL server».
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-[var(--color-background-secondary)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] truncate">
            {origin || "…"}
          </code>
          <button
            type="button"
            onClick={copyUrl}
            disabled={!origin}
            className="shrink-0 rounded-md border border-[var(--color-border-secondary)] bg-transparent px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-secondary)] disabled:opacity-50"
          >
            Copia
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Monitor CAN in tempo reale">
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          Inserisci il <strong className="text-[var(--color-text-primary)]">device_id</strong> configurato sull&apos;ESP32
          per vedere in tempo reale se stanno arrivando frame CAN dal veicolo.
        </p>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-[11px] text-[var(--color-text-secondary)]" htmlFor="monitor-device-id">
            Device ID
          </label>
          <input
            id="monitor-device-id"
            type="text"
            placeholder="es. evdiag-esp32-01"
            value={monitorDeviceId}
            onChange={(e) => setMonitorDeviceId(e.target.value)}
            className="w-full sm:w-[280px] rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2.5 py-2 text-xs text-[var(--color-text-primary)]"
          />
        </div>
        <CanSnifferPanel deviceId={monitorDeviceId.trim() || null} />
      </SectionCard>
    </div>
  );
}
