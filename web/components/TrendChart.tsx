"use client";

export interface TrendPoint {
  at: string;
  value: number;
  label?: string;
}

export interface TrendChartProps {
  data?: TrendPoint[] | null;
  title?: string;
  unit?: string;
  className?: string;
}

export default function TrendChart({
  data = [],
  title = "Andamento",
  unit = "",
  className = "",
}: TrendChartProps) {
  const points = Array.isArray(data) ? data : [];
  const hasData = points.length > 0;
  const values = points.map((p) => p.value);
  const min = values.length ? Math.min(...values, 0) : 0;
  const max = values.length ? Math.max(...values, 100) : 100;
  const range = max - min || 1;

  return (
    <div className={`dashboard-card ${className}`} role="region" aria-label={title}>
      <h2>{title}</h2>
      {!hasData && <p>Nessun dato da visualizzare.</p>}
      {hasData && (
        <div className="trend-bars">
          {points.slice(-24).map((p, i) => (
            <div
              key={i}
              className="trend-bar"
              style={{
                height: `${((p.value - min) / range) * 100}%`,
                minHeight: 4,
              }}
              title={`${p.value} ${unit} - ${p.at}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
