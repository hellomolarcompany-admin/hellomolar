-- Hardening migration: indexes, drop unused column, audit log

-- 1) Drop unused column from IntakeSubmission (if present)
ALTER TABLE "public"."IntakeSubmission" DROP COLUMN IF EXISTS "fingerprint";

-- 2) Helpful indexes for admin listing/search
DO $$ BEGIN
  CREATE INDEX "IntakeSubmission_fullName_idx" ON "public"."IntakeSubmission"("fullName");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX "IntakeSubmission_email_idx" ON "public"."IntakeSubmission"("email");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX "IntakeSubmission_phone_idx" ON "public"."IntakeSubmission"("phone");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- 3) AdminAuditLog table (idempotent create)
CREATE TABLE IF NOT EXISTS "public"."AdminAuditLog" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "adminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "ipInet" TEXT,
  "userAgent" TEXT
);

-- Indexes for AdminAuditLog
DO $$ BEGIN
  CREATE INDEX "AdminAuditLog_createdAt_idx" ON "public"."AdminAuditLog"("createdAt");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "public"."AdminAuditLog"("adminId", "createdAt");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

