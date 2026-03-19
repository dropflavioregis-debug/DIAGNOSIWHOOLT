"use client";

import { useState } from "react";
import { SectionCard } from "@/components/common/SectionCard";
import { EmptyState } from "@/components/common/EmptyState";

export default function DevicePage() {
  const [ssid, setSsid] = useState("");
  const [serverUrl, setServerUrl] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-medium text-[var(--color-text-primary)]">Dispositivo</h1>
        <p className="text-xs text-[var(--color-text-secondary)]">ESP32-S3 — WiFi, CAN, OTA</p>
      </div>

      <EmptyState
        title="In attesa di connessione"
        description="Nessun dispositivo connesso. Configura l'URL del server e le credenziali WiFi qui sotto, poi connetti l'ESP32."
      />

      <SectionCard title="Configurazione WiFi e server">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-primary)]">Nome rete WiFi (SSID)</label>
            <input
              type="text"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="SSID della rete"
              className="w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-primary)]">Password WiFi</label>
            <input
              type="password"
              placeholder="••••••••••"
              className="w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-primary)]">URL server Vercel</label>
          <input
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://tuo-progetto.vercel.app"
            className="w-full rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded-md border border-[var(--color-border-secondary)] bg-transparent px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-secondary)]"
          >
            Salva in NVS
          </button>
          <button
            type="button"
            className="rounded-md bg-[#1D9E75] px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            Invia a dispositivo
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
