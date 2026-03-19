import type { DTCSeverity } from "./types";

export type BadgeVariant = "green" | "amber" | "red" | "blue";

export function severityToBadgeVariant(severity: DTCSeverity): BadgeVariant {
  switch (severity) {
    case "critical":
      return "red";
    case "warning":
      return "amber";
    case "info":
      return "blue";
    default:
      return "blue";
  }
}

export function severityToBarColor(severity: DTCSeverity): string {
  switch (severity) {
    case "critical":
      return "#E24B4A";
    case "warning":
      return "#EF9F27";
    case "info":
      return "#378ADD";
    default:
      return "#737373";
  }
}
