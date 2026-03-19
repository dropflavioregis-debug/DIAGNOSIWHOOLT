-- Enable Row Level Security on all tables.
-- Backend uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS.
-- Anon key gets read-only access to catalog tables (vehicles, signals, dtc).

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE dtc ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings ENABLE ROW LEVEL SECURITY;

-- Anon: read-only on catalog data (for libs/vehicle detection from client if needed).
CREATE POLICY "anon_select_vehicles" ON vehicles FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_signals" ON signals FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_dtc" ON dtc FOR SELECT TO anon USING (true);

-- Sessions and readings: no anon policy; only service_role (backend) can read/write.
