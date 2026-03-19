-- Segnali / DID per ogni veicolo
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id),
  name TEXT NOT NULL,
  description TEXT,
  did TEXT,
  ecu_address TEXT,
  formula TEXT,
  unit TEXT,
  min_value FLOAT,
  max_value FLOAT,
  category TEXT,
  source_file TEXT
);

CREATE INDEX idx_signals_vehicle ON signals(vehicle_id);
