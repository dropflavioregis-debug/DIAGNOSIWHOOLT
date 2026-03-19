import type { MetricItem } from "@/lib/types";

interface MetricCardProps {
  item: MetricItem;
}

export function MetricCard({ item }: MetricCardProps) {
  return (
    <div
      style={{
        background: "var(--color-background-secondary)",
        borderRadius: "var(--border-radius-md)",
        padding: "14px 16px",
      }}
    >
      <div
        className="text-[11px]"
        style={{ color: "var(--color-text-secondary)", marginBottom: "6px" }}
      >
        {item.label}
      </div>
      <div
        className="leading-none"
        style={{
          fontSize: "22px",
          fontWeight: 500,
          color: "var(--color-text-primary)",
        }}
      >
        {item.value}
        <span style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
          {item.unit}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={item.barPct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: "4px",
          background: "var(--color-border-tertiary)",
          borderRadius: "2px",
          marginTop: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${item.barPct}%`,
            height: "100%",
            borderRadius: "2px",
            background: item.barColor,
            transition: "width 0.3s",
          }}
        />
      </div>
      <div
        className="text-[11px]"
        style={{ color: "var(--color-text-tertiary)", marginTop: "4px" }}
      >
        {item.sub}
      </div>
    </div>
  );
}
