/**
 * Library sources from ev-diagnostic-plan.md — GitHub repos to clone for DID/DTC/signals.
 */

export interface LibrarySource {
  name: string;
  repo: string;
  type: "obdb_org" | "single_repo";
  format: string;
  covers?: string[];
  priority: number;
}

export const LIBRARY_SOURCES: LibrarySource[] = [
  {
    name: "OBDb - Community OBD Database",
    repo: "https://github.com/OBDb",
    type: "obdb_org",
    format: "json_signalset_v3",
    priority: 1,
  },
  {
    name: "JejuSoul - Hyundai/Kia EV PIDs",
    repo: "https://github.com/JejuSoul/OBD-PIDs-for-HKMC-EVs",
    type: "single_repo",
    format: "csv_extendedpids",
    covers: ["Hyundai Kona EV", "Kia Niro EV", "Ioniq 5", "EV6"],
    priority: 1,
  },
  {
    name: "iDoka - Awesome Automotive CAN IDs",
    repo: "https://github.com/iDoka/awesome-automotive-can-id",
    type: "single_repo",
    format: "dbc_and_json",
    covers: ["Tesla Model 3", "Tesla Model S", "Renault Zoe", "VW MEB", "PSA"],
    priority: 1,
  },
  {
    name: "OVMS - Open Vehicle Monitoring System",
    repo: "https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3",
    type: "single_repo",
    format: "cpp_vehicle_modules",
    covers: ["Nissan Leaf", "Renault Zoe", "Tesla Model S", "VW e-Golf", "Smart ED"],
    priority: 2,
  },
  {
    name: "prototux - PSA CAN Reverse Engineering",
    repo: "https://github.com/prototux/PSA-CAN-RE",
    type: "single_repo",
    format: "dbc",
    covers: ["Peugeot e-208", "Citroën e-C4", "DS 3 Crossback E-Tense"],
    priority: 1,
  },
  {
    name: "todrobbins - DTC Database",
    repo: "https://github.com/todrobbins/dtcdb",
    type: "single_repo",
    format: "json_dtc",
    priority: 1,
  },
  {
    name: "teslarent - Tesla Model 3 CAN",
    repo: "https://github.com/teslarent/model3-can",
    type: "single_repo",
    format: "dbc",
    covers: ["Tesla Model 3", "Tesla Model Y"],
    priority: 1,
  },
  {
    name: "EVNotify - VW MEB Signals",
    repo: "https://github.com/EVNotify/EVNotify",
    type: "single_repo",
    format: "json",
    covers: ["VW ID.3", "VW ID.4", "Skoda Enyaq", "Audi Q4"],
    priority: 2,
  },
  {
    name: "OpenEV Data - EV Specifications",
    repo: "https://github.com/open-ev-data/open-ev-data-dataset",
    type: "single_repo",
    format: "json_ev_specs",
    priority: 2,
  },
];
