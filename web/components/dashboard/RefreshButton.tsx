"use client";

import { useRouter } from "next/navigation";

type RefreshButtonProps = {
  label?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function RefreshButton({ label = "Aggiorna", className, style }: RefreshButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className={
        className ??
        "rounded-[var(--border-radius-md)] border border-[var(--color-border-secondary)] bg-transparent transition-colors hover:bg-[var(--color-background-secondary)]"
      }
      style={{
        padding: "5px 14px",
        fontSize: "11px",
        color: "var(--color-text-secondary)",
        ...style,
      }}
    >
      {label}
    </button>
  );
}
