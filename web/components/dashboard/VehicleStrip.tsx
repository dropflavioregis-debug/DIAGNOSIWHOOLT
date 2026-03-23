import type { VehicleInfo } from "@/lib/types";
import { StatusBadge } from "@/components/common/StatusBadge";

interface VehicleStripProps {
  vehicle: VehicleInfo;
}

function CarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 12L5 6h10l2 6"
        stroke="var(--color-text-info)"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <rect
        x="2"
        y="12"
        width="16"
        height="4"
        rx="2"
        stroke="var(--color-text-info)"
        strokeWidth="1.3"
      />
      <circle cx="6" cy="16" r="1.5" fill="var(--color-text-info)" />
      <circle cx="14" cy="16" r="1.5" fill="var(--color-text-info)" />
    </svg>
  );
}

export function VehicleStrip({ vehicle }: VehicleStripProps) {
  return (
    <div
      className="flex items-center min-w-0"
      style={{
        background: "var(--color-background-secondary)",
        borderRadius: "var(--border-radius-md)",
        padding: "10px 14px",
        marginBottom: "16px",
        gap: "12px",
      }}
    >
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "var(--border-radius-md)",
          background: "var(--color-background-info)",
        }}
      >
        <CarIcon />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          {vehicle.name}
        </div>
        <div
          className="text-[11px]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {vehicle.meta}
        </div>
        {vehicle.liveSubtitle && (
          <div
            className="text-[11px]"
            style={{ color: "var(--color-text-tertiary)", marginTop: "2px" }}
          >
            {vehicle.liveSubtitle}
          </div>
        )}
        {vehicle.vin && (
          <div
            className="text-[11px] font-mono"
            style={{ color: "var(--color-text-secondary)", marginTop: "2px" }}
            title={vehicle.vin}
          >
            VIN: {vehicle.vin.slice(0, 4)}…{vehicle.vin.slice(-4)}
          </div>
        )}
      </div>
      {vehicle.connectionStatus === "live" && (
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge variant="green">Connessa</StatusBadge>
        </div>
      )}
      {vehicle.connectionStatus === "pending" && (
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge variant="amber">Connessione…</StatusBadge>
        </div>
      )}
      {vehicle.connectionStatus === "offline" && (
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge variant="gray">Non connessa</StatusBadge>
        </div>
      )}
    </div>
  );
}
