-- Comandi inviati dalla webapp verso i dispositivi ESP32 (polling).
-- Il dispositivo chiama GET /api/device/commands?device_id=... e riceve i comandi in sospeso.
CREATE TABLE device_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  command TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX idx_device_commands_device_pending ON device_commands (device_id) WHERE acknowledged_at IS NULL;

COMMENT ON TABLE device_commands IS 'Comandi da webapp a ESP32; il dispositivo fa polling e marca acknowledged_at quando li ha letti.';
