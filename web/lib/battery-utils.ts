import type { BatteryReading, MetricItem } from "./types";

const CELL_COLORS: { bg: string; text: string }[] = [
  { bg: "var(--blue-100)", text: "var(--blue-800)" },
  { bg: "var(--blue-200)", text: "var(--blue-800)" },
  { bg: "var(--teal-200)", text: "var(--teal-800)" },
  { bg: "var(--teal-400)", text: "var(--teal-900)" },
  { bg: "var(--teal-100)", text: "var(--teal-800)" },
  { bg: "var(--amber-200)", text: "var(--amber-800)" },
  { bg: "var(--red-400)", text: "var(--red-800)" },
];

export function getCellColor(temp: number): { bg: string; text: string } {
  const norm = Math.min(1, Math.max(0, (temp - 20) / 10));
  const ci = Math.floor(norm * (CELL_COLORS.length - 1));
  return CELL_COLORS[Math.min(ci, CELL_COLORS.length - 1)] ?? CELL_COLORS[0];
}

export function getBatteryMetrics(b: BatteryReading): MetricItem[] {
  return [
    { label: "SOC attuale", value: b.soc, unit: "%", barPct: b.soc, barColor: "#1D9E75", sub: "—" },
    { label: "SOH batteria", value: b.soh, unit: "%", barPct: b.soh, barColor: "#378ADD", sub: "—" },
    { label: "Temp. massima cella", value: b.tempMax, unit: "°C", barPct: 40, barColor: "#EF9F27", sub: "—" },
    { label: "Tensione pack", value: b.packVoltage, unit: "V", barPct: 71, barColor: "#7F77DD", sub: "—" },
  ];
}
