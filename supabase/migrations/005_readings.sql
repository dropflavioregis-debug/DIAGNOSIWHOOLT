-- Letture parametri (time series)
CREATE TABLE readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id),
  signal_id UUID REFERENCES signals(id),
  value FLOAT NOT NULL,
  raw_value TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_readings_session ON readings(session_id);
CREATE INDEX idx_readings_signal ON readings(signal_id);
CREATE INDEX idx_readings_time ON readings(recorded_at DESC);
