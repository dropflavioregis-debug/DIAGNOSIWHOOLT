type Variant = "green" | "amber" | "red" | "blue";

const variants: Record<
  Variant,
  { background: string; color: string }
> = {
  green: { background: "var(--green-50)", color: "var(--green-600)" },
  amber: { background: "var(--amber-50)", color: "var(--amber-600)" },
  red: { background: "var(--red-50)", color: "var(--red-600)" },
  blue: { background: "var(--blue-50)", color: "var(--blue-600)" },
};

interface StatusBadgeProps {
  variant: Variant;
  children: React.ReactNode;
  showDot?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function StatusBadge({ variant, children, showDot = true, className = "", style: styleProp }: StatusBadgeProps) {
  const style = variants[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${className}`}
      style={{
        background: style.background,
        color: style.color,
        padding: "4px 10px",
        fontSize: "11px",
        ...styleProp,
      }}
    >
      {showDot && (
        <span
          className="shrink-0 rounded-full bg-current"
          style={{ width: "6px", height: "6px" }}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
