"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "@/lib/nav-config";
import { NavIcon } from "./NavIcons";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col" style={{ gap: "4px" }}>
      {NAV_SECTIONS.map((section, idx) => (
        <div key={section.label} style={idx > 0 ? { marginTop: "8px" } : undefined}>
          <div
            className="text-[10px] font-medium uppercase"
            style={{
              color: "var(--color-text-tertiary)",
              padding: "10px 10px 4px",
              letterSpacing: "0.05em",
            }}
            aria-hidden
          >
            {section.label}
          </div>
          {section.items.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center rounded-[var(--border-radius-md)] text-[13px] transition-colors hover:bg-[var(--color-background-primary)]"
                style={{
                  padding: "7px 10px",
                  gap: "9px",
                  background: isActive ? "var(--color-background-primary)" : undefined,
                  color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  fontWeight: isActive ? 500 : 400,
                }}
                aria-current={isActive ? "page" : undefined}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
