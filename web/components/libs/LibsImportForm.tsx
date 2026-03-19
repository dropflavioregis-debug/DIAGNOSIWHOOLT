"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function LibsImportForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setMessage({ type: "err", text: "Inserisci l'URL del file JSON." });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/libs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? `Errore ${res.status}` });
        return;
      }
      setMessage({
        type: "ok",
        text:
          data.make && data.model
            ? `Importata: ${data.make} ${data.model} (${data.signalsAdded ?? 0} segnali, ${data.dtcAdded ?? 0} DTC). Salvata anche in Storage.`
            : "Libreria importata e salvata in Storage.",
      });
      setUrl("");
      router.refresh();
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Errore di rete" });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/libs/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? `Errore ${res.status}` });
        return;
      }
      setMessage({
        type: "ok",
        text:
          data.make && data.model
            ? `Caricata: ${data.make} ${data.model} (${data.signalsAdded ?? 0} segnali, ${data.dtcAdded ?? 0} DTC). Salvata in Storage.`
            : "Libreria caricata e salvata in Storage.",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Errore di rete" });
    } finally {
      setUploadLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <p className="text-[11px] font-medium text-[var(--color-text-secondary)]">Da URL</p>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://raw.githubusercontent.com/.../file.json"
            disabled={loading}
            className="min-w-0 flex-1 rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-primary)] focus:outline-none disabled:opacity-60"
            aria-label="URL file JSON libreria"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-tertiary)] disabled:opacity-60"
          >
            {loading ? "Importazione…" : "Importa da URL"}
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-medium text-[var(--color-text-secondary)]">Carica file JSON</p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleUpload}
            disabled={uploadLoading}
            className="block max-w-[220px] text-[11px] file:mr-2 file:rounded-md file:border-0 file:bg-[var(--color-background-tertiary)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--color-text-primary)]"
            aria-label="File JSON libreria"
          />
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            {uploadLoading ? "Caricamento…" : "Max 5 MB"}
          </span>
        </div>
      </div>

      {message && (
        <p
          className={`text-[11px] ${message.type === "ok" ? "text-[var(--color-text-success)]" : "text-[var(--color-text-danger)]"}`}
        >
          {message.text}
        </p>
      )}

      <p className="text-[11px] text-[var(--color-text-tertiary)]">
        I file vengono salvati in Supabase Storage e i dati (veicoli, segnali, DTC) vengono importati nel database per
        la diagnosi. Funziona anche su Vercel.
      </p>
    </div>
  );
}
