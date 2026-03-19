-- Performance indexes for common query patterns.

CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at_desc ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_dtc_vehicle_code ON dtc(vehicle_id, code);
