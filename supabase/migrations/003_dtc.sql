-- Database DTC
CREATE TABLE dtc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id),
  description_it TEXT,
  description_en TEXT,
  severity TEXT,
  system TEXT,
  possible_causes TEXT[],
  source_file TEXT
);

CREATE INDEX idx_dtc_code ON dtc(code);
