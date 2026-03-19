"use client";

export interface DiagnosisPanelProps {
  text?: string | null;
  loading?: boolean;
  className?: string;
}

export default function DiagnosisPanel({
  text,
  loading = false,
  className = "",
}: DiagnosisPanelProps) {
  return (
    <div className={`dashboard-card ${className}`} role="region" aria-label="Diagnosi AI">
      <h2>Diagnosi (Claude)</h2>
      {loading && <p>Analisi in corso…</p>}
      {!loading && !text && <p>Nessuna diagnosi disponibile. Avvia un&apos;analisi dalla sessione.</p>}
      {!loading && text && <div style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>{text}</div>}
    </div>
  );
}
