import type { AIMessage } from "@/lib/types";

interface AIPanelProps {
  messages: AIMessage[];
}

export function AIPanel({ messages }: AIPanelProps) {
  return (
    <div className="flex flex-col" style={{ gap: "10px" }}>
      <div className="flex flex-col" style={{ gap: "10px" }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className="rounded-[var(--border-radius-md)] text-[12px] leading-relaxed whitespace-pre-line"
            style={{
              background: "var(--color-background-secondary)",
              padding: "12px 14px",
              color: "var(--color-text-secondary)",
              borderLeft: `2px solid ${msg.borderColor ?? "var(--teal-400)"}`,
            }}
          >
            <strong className="font-medium" style={{ color: "var(--color-text-primary)" }}>
              {msg.title}
            </strong>
            <div style={{ marginTop: "4px" }}>{msg.body}</div>
          </div>
        ))}
      </div>
      <div className="flex" style={{ gap: "8px" }}>
        <button
          type="button"
          className="flex-1 rounded-[var(--border-radius-md)] border border-[var(--color-border-secondary)] bg-transparent text-center transition-colors hover:bg-[var(--color-background-secondary)]"
          style={{ padding: "8px", fontSize: "11px", color: "var(--color-text-secondary)" }}
        >
          Approfondisci
        </button>
        <button
          type="button"
          className="flex-1 rounded-[var(--border-radius-md)] border border-[var(--color-border-secondary)] bg-transparent text-center transition-colors hover:bg-[var(--color-background-secondary)]"
          style={{ padding: "8px", fontSize: "11px", color: "var(--color-text-secondary)" }}
        >
          Scarica report
        </button>
      </div>
    </div>
  );
}
