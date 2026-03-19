-- Sessioni diagnostica (ogni volta che connetti l'auto)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  can_fingerprint JSONB,
  raw_dtc TEXT[],
  ai_diagnosis TEXT,
  metadata JSONB
);
