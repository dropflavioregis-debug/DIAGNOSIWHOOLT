-- Add VIN and decoded VIN to sessions (for CAN/UDS VIN reading + Corgi decode)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS vin TEXT,
  ADD COLUMN IF NOT EXISTS vin_decoded JSONB;

COMMENT ON COLUMN sessions.vin IS 'Raw 17-char VIN from vehicle (e.g. via UDS ReadDataByIdentifier)';
COMMENT ON COLUMN sessions.vin_decoded IS 'Corgi decode result: make, model, year, valid, etc.';
