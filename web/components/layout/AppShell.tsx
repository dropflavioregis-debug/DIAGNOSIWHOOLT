"use client";

import { SidebarNav } from "./SidebarNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid min-h-screen"
      style={{ gridTemplateColumns: "220px 1fr" }}
    >
      <aside
        className="flex flex-col bg-[var(--color-background-secondary)]"
        style={{
          borderRight: "0.5px solid var(--color-border-tertiary)",
          padding: "16px 12px",
          gap: "4px",
        }}
      >
        <div
          className="flex items-center gap-2 pb-3"
          style={{
            borderBottom: "0.5px solid var(--color-border-tertiary)",
            marginBottom: "8px",
            paddingLeft: "8px",
            paddingRight: "8px",
          }}
        >
          <div
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: "var(--teal-400)" }}
            aria-hidden
          />
          <span
            className="text-[13px] font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            EV Diagnostic
          </span>
        </div>
        <SidebarNav />
        <div
          className="mt-auto pt-3"
          style={{ borderTop: "0.5px solid var(--color-border-tertiary)" }}
        >
          <div
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <span
              className="pulse"
              style={{ flexShrink: 0, width: "7px", height: "7px", display: "inline-block" }}
              aria-hidden
            />
            ESP32-S3 connesso
          </div>
        </div>
      </aside>
      <main
        className="overflow-y-auto bg-[var(--color-background-primary)]"
        style={{ padding: "20px 24px" }}
      >
        {children}
      </main>
    </div>
  );
}
