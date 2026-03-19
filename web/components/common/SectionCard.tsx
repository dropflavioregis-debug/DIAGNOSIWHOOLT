interface SectionCardProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, action, children, className = "" }: SectionCardProps) {
  return (
    <div
      className={className}
      style={{
        background: "var(--color-background-secondary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "16px",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: "14px" }}
      >
        <span
          className="text-[13px] font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}
