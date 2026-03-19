/**
 * Internal JSON format for vehicle libs (aligned with Supabase schema and API /api/libs/[vehicle_id]).
 */

export interface SignalJson {
  name: string;
  description?: string;
  did?: string;
  ecu_address?: string;
  formula?: string;
  unit?: string;
  min_value?: number;
  max_value?: number;
  category?: string;
  source_file?: string;
}

export interface DtcJson {
  code: string;
  description_it?: string;
  description_en?: string;
  severity?: string;
  system?: string;
  possible_causes?: string[];
  source_file?: string;
}

export interface VehicleLibJson {
  vehicle_id?: string;
  make: string;
  model: string;
  year_from?: number;
  year_to?: number;
  can_ids?: string[];
  signals: SignalJson[];
  dtc: DtcJson[];
}
