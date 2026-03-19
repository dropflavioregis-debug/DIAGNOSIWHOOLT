-- Tabella veicoli supportati
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year_from INT,
  year_to INT,
  can_ids TEXT[],
  protocol TEXT DEFAULT 'UDS',
  can_speed INT DEFAULT 500,
  source_repo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
