-- Control plane for OTA rollout and protocol profiles.

CREATE TABLE firmware_rollout_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  rollout_mode TEXT NOT NULL DEFAULT 'manual',
  allow_auto BOOLEAN NOT NULL DEFAULT false,
  allowlist_devices JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_version TEXT NOT NULL,
  binary_url TEXT NOT NULL,
  binary_md5 TEXT,
  min_supported_version TEXT,
  rollout_group TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_firmware_rollout_rules_channel ON firmware_rollout_rules (channel, updated_at DESC);

CREATE TABLE protocol_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'generic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE protocol_profile_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES protocol_profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, version)
);

CREATE INDEX idx_protocol_profile_versions_active ON protocol_profile_versions (profile_id, is_active);

CREATE TABLE device_profile_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  profile_id UUID NOT NULL REFERENCES protocol_profiles(id) ON DELETE CASCADE,
  pinned_version INTEGER,
  channel TEXT NOT NULL DEFAULT 'stable',
  auto_apply BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id)
);

CREATE INDEX idx_device_profile_assignment_device ON device_profile_assignment (device_id);

CREATE TABLE device_update_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'info',
  firmware_version TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_update_events_device ON device_update_events (device_id, created_at DESC);

CREATE TABLE device_runtime_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  source TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_runtime_audit_device ON device_runtime_audit (device_id, created_at DESC);

COMMENT ON TABLE firmware_rollout_rules IS 'Policy OTA per canale/gruppo: manuale default, auto per allowlist.';
COMMENT ON TABLE protocol_profiles IS 'Profili logici diagnostici modificabili da dashboard.';
COMMENT ON TABLE protocol_profile_versions IS 'Versionamento payload runtime dei profili protocollo.';
COMMENT ON TABLE device_profile_assignment IS 'Assegnazione device -> profilo/versione/channel.';
COMMENT ON TABLE device_update_events IS 'Eventi aggiornamenti OTA e sicurezza.';
COMMENT ON TABLE device_runtime_audit IS 'Audit trail comandi e operazioni control-plane.';
