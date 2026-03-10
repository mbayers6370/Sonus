CREATE TABLE IF NOT EXISTS legal_document_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  document_version TEXT NOT NULL,
  acceptance_source TEXT NOT NULL DEFAULT 'signup',
  age_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_ip TEXT,
  accepted_user_agent TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT legal_document_acceptances_user_document_version_key
    UNIQUE (user_id, document_type, document_version)
);

CREATE INDEX IF NOT EXISTS legal_document_acceptances_user_id_accepted_at_idx
  ON legal_document_acceptances (user_id, accepted_at);
