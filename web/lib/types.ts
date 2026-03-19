export interface VehicleInfo {
  name: string;
  meta: string;
  connected: boolean;
}

export interface MetricItem {
  label: string;
  value: number;
  unit: string;
  barPct: number;
  barColor: string;
  sub: string;
}

export type DTCSeverity = "critical" | "warning" | "info";

export type DTCFilter = "all" | "active" | "pending" | "cleared";

export interface DTCItem {
  code: string;
  name: string;
  description: string;
  severity: DTCSeverity;
  type?: "active" | "pending" | "cleared";
  causes?: string;
  action?: string;
  system?: string;
  ecu?: string;
  ecu_addr?: string;
}

export interface ECUItem {
  addr: string;
  name: string;
  dotColor: string;
  count: string;
}

export interface AIMessage {
  title: string;
  body: string;
  borderColor?: string;
}

export interface BatteryReading {
  soc: number;
  soh: number;
  tempMax: number;
  tempMin: number;
  tempAvg: number;
  packVoltage: number;
  cellTemps: number[];
}
