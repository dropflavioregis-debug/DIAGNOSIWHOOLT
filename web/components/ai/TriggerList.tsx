const TRIGGERS: { title: string; desc: string; bg: string; fg: string }[] = [
  {
    title: "DTC critico rilevato",
    desc: "Analisi immediata + notifica · severity = critical",
    bg: "var(--red-50)",
    fg: "var(--red-600)",
  },
  {
    title: "SOH sceso sotto soglia",
    desc: "Analisi degradazione · soglia configurabile (default 85%)",
    bg: "var(--amber-50)",
    fg: "var(--amber-600)",
  },
  {
    title: "Fine sessione di guida",
    desc: "Report completo automatico · sessione chiusa da ESP32",
    bg: "var(--blue-50)",
    fg: "var(--blue-600)",
  },
  {
    title: "Anomalia termica celle",
    desc: "Delta temp > 3°C tra celle · analisi modulo specifico",
    bg: "var(--amber-50)",
    fg: "var(--amber-600)",
  },
];

export function TriggerList() {
  return (
    <div className="flex flex-col" style={{ gap: "8px" }}>
      {TRIGGERS.map((t) => (
        <div
          key={t.title}
          className="flex cursor-pointer items-start rounded-[var(--border-radius-md)] transition-colors hover:bg-[var(--color-background-tertiary)]"
          style={{
            gap: "10px",
            padding: "10px 12px",
            border: "0.5px solid var(--color-border-tertiary)",
            background: "var(--color-background-tertiary)",
          }}
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--border-radius-md)]"
            style={{ background: t.bg }}
            aria-hidden
          >
            <span
              className="text-xs font-medium"
              style={{ color: t.fg }}
            >
              !
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-[12px] font-medium"
              style={{ color: "var(--color-text-primary)", marginBottom: "2px" }}
            >
              {t.title}
            </div>
            <div
              className="text-[11px] leading-snug"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {t.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
