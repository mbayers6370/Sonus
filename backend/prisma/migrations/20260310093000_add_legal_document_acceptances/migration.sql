-- CreateTable
CREATE TABLE IF NOT EXISTS "legal_document_acceptances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_version" TEXT NOT NULL,
    "acceptance_source" TEXT NOT NULL DEFAULT 'signup',
    "age_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "accepted_ip" TEXT,
    "accepted_user_agent" TEXT,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_document_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "legal_document_acceptances_user_id_document_type_document_version_key"
  ON "legal_document_acceptances"("user_id", "document_type", "document_version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "legal_document_acceptances_user_id_accepted_at_idx"
  ON "legal_document_acceptances"("user_id", "accepted_at");
