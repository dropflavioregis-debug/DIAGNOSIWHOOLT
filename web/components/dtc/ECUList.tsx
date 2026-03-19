import type { ECUItem } from "@/lib/types";

interface ECUListProps {
  items: ECUItem[];
}

export function ECUList({ items }: ECUListProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((e) => (
        <div
          key={e.addr}
          className="flex cursor-pointer items-center gap-2.5 rounded-[var(--border-radius-md)] px-2.5 py-2 transition-colors hover:bg-[var(--color-background-secondary)]"
          style={{ border: "0.5px solid var(--color-border-tertiary)" }}
        >
          <div
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: e.dotColor }}
            aria-hidden
          />
          <span className="w-12 shrink-0 font-mono text-[11px] text-[var(--color-text-tertiary)]">{e.addr}</span>
          <span className="flex-1 text-xs font-medium text-[var(--color-text-primary)]">{e.name}</span>
          <span className="text-[11px] text-[var(--color-text-secondary)]">{e.count}</span>
        </div>
      ))}
    </div>
  );
}
