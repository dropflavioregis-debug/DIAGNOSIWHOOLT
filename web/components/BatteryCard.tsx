"use client";

export interface BatteryCardProps {
  soc?: number | null;
  soh?: number | null;
  temp?: number | null;
  voltage?: number | null;
  unit?: string;
  className?: string;
}

export default function BatteryCard({
  soc,
  soh,
  temp,
  voltage,
  unit = "%",
  className = "",
}: BatteryCardProps) {
  const hasData = soc != null || soh != null || temp != null || voltage != null;
  return (
    <div
      className={`dashboard-card ${className}`}
      role="region"
      aria-label="Stato batteria"
    >
      <h2>Batteria</h2>
      {!hasData && (
        <p>Nessun dato batteria disponibile.</p>
      )}
      {hasData && (
        <dl style={{ display: "grid", gap: "0.5rem", fontSize: "0.875rem" }}>
          {soc != null && (
            <>
              <dt style={{ color: "var(--color-text-secondary)" }}>SOC</dt>
              <dd style={{ fontWeight: 500 }}>
                {soc} {unit}
              </dd>
            </>
          )}
          {soh != null && (
            <>
              <dt style={{ color: "var(--color-text-secondary)" }}>SOH</dt>
              <dd style={{ fontWeight: 500 }}>
                {soh} {unit}
              </dd>
            </>
          )}
          {temp != null && (
            <>
              <dt style={{ color: "var(--color-text-secondary)" }}>Temperatura</dt>
              <dd style={{ fontWeight: 500 }}>{temp} °C</dd>
            </>
          )}
          {voltage != null && (
            <>
              <dt style={{ color: "var(--color-text-secondary)" }}>Tensione</dt>
              <dd style={{ fontWeight: 500 }}>{voltage} V</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
