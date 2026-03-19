interface EmptyStateProps {
  title?: string;
  description?: string;
}

const DEFAULT_TITLE = "Nessun dato disponibile";
const DEFAULT_DESCRIPTION = "Connetti un veicolo o avvia una sessione diagnostica per vedere i dati.";

export function EmptyState({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[var(--border-radius-md)] py-12 px-6 text-center"
      style={{
        background: "var(--color-background-secondary)",
        border: "1px dashed var(--color-border-tertiary)",
      }}
    >
      <p
        className="text-sm font-medium mb-1"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </p>
      <p
        className="text-xs max-w-[280px]"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {description}
      </p>
    </div>
  );
}
