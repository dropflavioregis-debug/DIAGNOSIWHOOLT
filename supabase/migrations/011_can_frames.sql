-- Frame CAN ricevuti dal sniffer (POST /api/can-sniffer/stream), persistiti per analisi ed export.
CREATE TABLE can_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  session_id UUID REFERENCES sessions(id),
  can_id BIGINT NOT NULL,
  extended BOOLEAN NOT NULL DEFAULT FALSE,
  len SMALLINT NOT NULL,
  data_hex TEXT NOT NULL DEFAULT '',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_can_frames_device_recorded ON can_frames(device_id, recorded_at DESC);
CREATE INDEX idx_can_frames_session ON can_frames(session_id) WHERE session_id IS NOT NULL;

COMMENT ON TABLE can_frames IS 'Frame CAN dallo sniffer; collegamento opzionale a sessions per export per sessione.';
