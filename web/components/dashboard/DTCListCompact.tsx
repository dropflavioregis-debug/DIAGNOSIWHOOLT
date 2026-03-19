"use client";

import React from "react";
import type { DTCItem } from "@/lib/types";
import { StatusBadge } from "@/components/common/StatusBadge";

const severityBadge: Record<DTCItem["severity"], "red" | "amber" | "blue"> = {
  critical: "red",
  warning: "amber",
  info: "blue",
};

interface DTCListCompactProps {
  items: DTCItem[];
  activeCount?: number;
  onClear?: () => void;
}

function dtcCodeStyle(severity: DTCItem["severity"]) {
  if (severity === "critical")
    return { background: "var(--red-50)", color: "var(--red-600)" };
  if (severity === "warning")
    return { background: "var(--amber-50)", color: "var(--amber-600)" };
  return { background: "var(--blue-50)", color: "var(--blue-600)" };
}

const filteredByTab = (
  items: DTCItem[],
  tab: "active" | "pending" | "history"
): DTCItem[] => {
  if (tab === "active") return items.filter((d) => d.type === "active");
  if (tab === "pending") return items.filter((d) => d.type === "pending");
  return items.filter((d) => d.type === "cleared" || d.type === undefined);
};

export function DTCListCompact({ items, activeCount = items.length, onClear }: DTCListCompactProps) {
  const [activeTab, setActiveTab] = React.useState<"active" | "pending" | "history">("active");
  const displayed = filteredByTab(items, activeTab);
  const pendingCount = items.filter((d) => d.type === "pending").length;
  const historyCount = items.filter((d) => d.type === "cleared" || !d.type).length;
  return (
    <div className="flex flex-col" style={{ gap: "8px" }}>
      <div className="flex" style={{ gap: "2px", marginBottom: "14px" }}>
        {[
          { id: "active" as const, label: `Attivi (${activeCount})` },
          { id: "pending" as const, label: `In sospeso (${pendingCount})` },
          { id: "history" as const, label: `Storico (${historyCount})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="rounded-[var(--border-radius-md)] border-none cursor-pointer transition-colors hover:opacity-90"
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              background: activeTab === tab.id ? "var(--color-background-secondary)" : "transparent",
              color: activeTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              fontWeight: activeTab === tab.id ? 500 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col" style={{ gap: "8px" }}>
        {displayed.map((d) => (
          <li
            key={d.code}
            className="flex cursor-pointer items-start transition-colors hover:bg-[var(--color-background-tertiary)]"
            style={{
              gap: "10px",
              padding: "10px 12px",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-background-tertiary)",
            }}
          >
            <span
              className="shrink-0 rounded font-mono text-[11px] font-medium whitespace-nowrap"
              style={{ padding: "2px 7px", ...dtcCodeStyle(d.severity) }}
            >
              {d.code}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="text-[12px] font-medium"
                style={{ color: "var(--color-text-primary)", marginBottom: "2px" }}
              >
                {d.name}
              </div>
              <div
                className="text-[11px] leading-snug"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {d.description}
              </div>
            </div>
            <StatusBadge variant={severityBadge[d.severity]} className="shrink-0" style={{ fontSize: "10px" }}>
              {d.severity === "critical" ? "Critico" : d.severity === "warning" ? "Avviso" : "Info"}
            </StatusBadge>
          </li>
        ))}
      </ul>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="self-start text-[11px] cursor-pointer hover:underline"
          style={{ color: "var(--color-text-info)" }}
        >
          Cancella tutti
        </button>
      )}
    </div>
  );
}
