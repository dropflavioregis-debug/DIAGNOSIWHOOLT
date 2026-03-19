"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/common/StatusBadge";

const QUICK_ASKS = [
  "Stato batteria",
  "Ricarica sicura?",
  "Vita residua",
  "Priorità errori",
];

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: input.trim() }]);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "ai", text: "Risposta simulata. Collega /api/analyze per risposte reali da Claude." },
    ]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--color-text-primary)]">Chat diagnostica AI</span>
        <StatusBadge variant="green">Claude Sonnet 4</StatusBadge>
      </div>
      <div className="flex max-h-[340px] flex-col gap-2 overflow-y-auto pr-0.5">
        {messages.length === 0 && (
          <p className="rounded-md bg-[var(--color-background-secondary)] px-3 py-2.5 text-xs text-[var(--color-text-secondary)]">
            Chiedi qualcosa sul veicolo. Usa i pulsanti rapidi o scrivi nel campo sotto.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] rounded-md px-3 py-2.5 text-xs leading-relaxed ${
              m.role === "ai"
                ? "self-start border-l-2 border-[#1D9E75] bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]"
                : "self-end bg-[var(--color-background-info)] text-[var(--color-text-info)] text-right"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_ASKS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setInput(q)}
            className="rounded-full border border-[var(--color-border-tertiary)] bg-transparent px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-text-primary)]"
          >
            {q}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Chiedi qualcosa al veicolo…"
          className="flex-1 rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
        />
        <button
          type="button"
          onClick={handleSend}
          className="rounded-md border border-[var(--color-border-secondary)] bg-transparent px-3.5 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-secondary)]"
        >
          Invia
        </button>
      </div>
    </div>
  );
}
