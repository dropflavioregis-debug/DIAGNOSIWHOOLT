"use client";

import { useRouter } from "next/navigation";

type LinkToAIButtonProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  query?: Record<string, string>;
};

export function LinkToAIButton({ children, className, style, query }: LinkToAIButtonProps) {
  const router = useRouter();
  const search = query && Object.keys(query).length > 0
    ? "?" + new URLSearchParams(query).toString()
    : "";
  return (
    <button
      type="button"
      onClick={() => router.push(`/ai${search}`)}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
