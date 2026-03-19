"use client";

export interface DTCItem {
  code: string;
  description?: string;
  severity?: string;
}

export interface DTCListProps {
  items?: DTCItem[] | string[] | null;
  className?: string;
}

export default function DTCList({ items = [], className = "" }: DTCListProps) {
  const list = Array.isArray(items)
    ? items.map((x) => (typeof x === "string" ? { code: x } : x))
    : [];
  const hasItems = list.length > 0;

  return (
    <div
      className={`dashboard-card ${className}`}
      role="region"
      aria-label="Codici DTC"
    >
      <h2>DTC ({list.length})</h2>
      {!hasItems && <p>Nessun codice guasto rilevato.</p>}
      {hasItems && (
        <ul style={{ listStyle: "disc inside", fontSize: "0.875rem" }}>
          {list.map((item, i) => (
            <li key={i}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{item.code}</span>
              {item.description && <span style={{ marginLeft: "0.5rem", color: "var(--color-text-secondary)" }}>— {item.description}</span>}
              {item.severity && <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem" }}>{item.severity}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
