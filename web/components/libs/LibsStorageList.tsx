"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type StorageFile = { name: string; path: string; updated_at: string | null };

export function LibsStorageList() {
  const router = useRouter();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [reimportPath, setReimportPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/libs/sources")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.files) setFiles(data.files);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleReimport(path: string) {
    setReimportPath(path);
    try {
      const res = await fetch("/api/libs/import-from-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) router.refresh();
      else alert(data.error ?? "Errore re-import");
    } finally {
      setReimportPath(null);
    }
  }

  if (loading) {
    return (
      <p className="text-[11px] text-[var(--color-text-tertiary)]">Caricamento file in Storage…</p>
    );
  }

  if (files.length === 0) {
    return (
      <p className="text-[11px] text-[var(--color-text-tertiary)]">
        Nessun file in Storage. Importa da URL o carica un file per salvare le librerie in Supabase.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {files.map((f) => (
        <li
          key={f.path}
          className="flex items-center gap-2.5 rounded-md border border-[var(--color-border-tertiary)] px-3 py-2 transition-colors hover:border-[var(--color-border-secondary)]"
        >
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--color-text-primary)]">
            {f.name}
          </span>
          <button
            type="button"
            onClick={() => handleReimport(f.path)}
            disabled={reimportPath === f.path}
            className="shrink-0 rounded border border-[var(--color-border-secondary)] bg-transparent px-2 py-1 text-[10px] text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] disabled:opacity-50"
          >
            {reimportPath === f.path ? "…" : "Re-importa nel DB"}
          </button>
        </li>
      ))}
    </ul>
  );
}
