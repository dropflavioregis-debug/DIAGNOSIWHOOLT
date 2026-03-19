import Link from "next/link";
import type { AIMessage } from "@/lib/types";

interface AIPanelProps {
  messages: AIMessage[];
  sessionId?: string | null;
}

const btnClass =
  "flex-1 rounded-[var(--border-radius-md)] border border-[var(--color-border-secondary)] bg-transparent text-center transition-colors hover:bg-[var(--color-background-secondary)]";
const btnStyle = { padding: "8px", fontSize: "11px", color: "var(--color-text-secondary)" as const };

export function AIPanel({ messages, sessionId }: AIPanelProps) {
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
        <Link href="/ai" className={btnClass} style={btnStyle}>
          Approfondisci
        </Link>
        {sessionId ? (
          <a
            href={`/api/sessions/${sessionId}/export`}
            download
            className={btnClass}
            style={btnStyle}
          >
            Scarica report
          </a>
        ) : (
          <span
            className={btnClass}
            style={{ ...btnStyle, opacity: 0.6, cursor: "not-allowed" }}
            title="Nessuna sessione disponibile"
          >
            Scarica report
          </span>
        )}
      </div>
    </div>
  );
}
