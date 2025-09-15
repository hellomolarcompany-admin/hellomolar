-- AlterTable
ALTER TABLE "public"."IntakeSubmission" ADD COLUMN     "encAlg" TEXT,
ADD COLUMN     "encKeyId" TEXT,
ADD COLUMN     "patientId" TEXT;

-- CreateTable
CREATE TABLE "public"."Patient" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "email" TEXT,
    "phone" TEXT,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OutboxEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Patient_lastName_firstName_idx" ON "public"."Patient"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Patient_email_idx" ON "public"."Patient"("email");

-- CreateIndex
CREATE INDEX "Patient_phone_idx" ON "public"."Patient"("phone");

-- CreateIndex
CREATE INDEX "OutboxEvent_createdAt_idx" ON "public"."OutboxEvent"("createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_topic_createdAt_idx" ON "public"."OutboxEvent"("topic", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
