-- CreateTable
CREATE TABLE "public"."IntakeSubmission" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fullName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "residentType" TEXT NOT NULL,
    "address" TEXT,
    "country" TEXT,
    "medications" JSONB NOT NULL,
    "allergies" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "hadComplications" BOOLEAN NOT NULL DEFAULT false,
    "complicationsNote" TEXT,
    "locale" TEXT NOT NULL,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "privacyAccepted" BOOLEAN NOT NULL,
    "userAgent" TEXT,
    "ipInet" TEXT,
    "fingerprint" TEXT,
    "encBlob" BYTEA,

    CONSTRAINT "IntakeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminUser" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntakeSubmission_createdAt_idx" ON "public"."IntakeSubmission"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "public"."AdminUser"("username");
