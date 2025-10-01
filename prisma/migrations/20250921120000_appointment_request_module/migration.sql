-- CreateEnum
CREATE TYPE "public"."PatientEventType" AS ENUM ('APPOINTMENT_REQUEST', 'CONTACT', 'NOTE');

-- CreateEnum
CREATE TYPE "public"."PatientEventStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."AppointmentRequestStatus" AS ENUM ('UNSCHEDULED', 'SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."AppointmentReason" AS ENUM ('CHECKUP', 'CLEANING', 'FILLING', 'EXTRACTION', 'ROOT_CANAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "public"."AppointmentContactChannel" AS ENUM ('PHONE', 'MAIL', 'WHATSAPP', 'FRONT_DESK');

-- CreateEnum
CREATE TYPE "public"."AppointmentFollowUpOutcome" AS ENUM ('WHATSAPP_SENT', 'CALLED_NO_ANSWER', 'CALLED_APPOINTMENT_MADE', 'WHATSAPP_CONFIRMED', 'DECLINED_OFFER');

-- CreateEnum
CREATE TYPE "public"."StaffRole" AS ENUM ('DENTIST', 'HYGIENIST', 'SUPPORT', 'DENTAL_ASSISTANT');

-- CreateTable
CREATE TABLE "public"."PatientEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "type" "public"."PatientEventType" NOT NULL,
    "status" "public"."PatientEventStatus" NOT NULL DEFAULT 'OPEN',
    "summary" TEXT,
    "payload" JSONB,
    "createdByStaffId" TEXT,

    CONSTRAINT "PatientEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppointmentRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "public"."AppointmentRequestStatus" NOT NULL DEFAULT 'UNSCHEDULED',
    "reasons" "public"."AppointmentReason"[],
    "plannedDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "basePriority" INTEGER NOT NULL DEFAULT 0,
    "triageScore" INTEGER NOT NULL DEFAULT 0,
    "declinePenalty" INTEGER NOT NULL DEFAULT 0,
    "effectivePriority" INTEGER NOT NULL DEFAULT 0,
    "triageInputs" JSONB,
    "preferredProviderIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availabilityMatrix" JSONB,
    "notes" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "nextActionAt" TIMESTAMP(3),
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "createdByStaffId" TEXT,

    CONSTRAINT "AppointmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AppointmentRequestFollowUp" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "eventId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "channel" "public"."AppointmentContactChannel" NOT NULL,
    "outcome" "public"."AppointmentFollowUpOutcome" NOT NULL,
    "notes" TEXT,
    "affectsPriority" BOOLEAN NOT NULL DEFAULT false,
    "priorityDelta" INTEGER NOT NULL DEFAULT 0,
    "staffId" TEXT,

    CONSTRAINT "AppointmentRequestFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StaffMember" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "bankAccount" TEXT,
    "role" "public"."StaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StaffEventInvolvement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "role" "public"."StaffRole" NOT NULL,

    CONSTRAINT "StaffEventInvolvement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientEvent_patientId_occurredAt_idx" ON "public"."PatientEvent"("patientId", "occurredAt");

-- CreateIndex
CREATE INDEX "PatientEvent_type_occurredAt_idx" ON "public"."PatientEvent"("type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentRequest_eventId_key" ON "public"."AppointmentRequest"("eventId");

-- CreateIndex
CREATE INDEX "AppointmentRequest_patientId_status_idx" ON "public"."AppointmentRequest"("patientId", "status");

-- CreateIndex
CREATE INDEX "AppointmentRequest_status_effectivePriority_idx" ON "public"."AppointmentRequest"("status", "effectivePriority");

-- CreateIndex
CREATE INDEX "AppointmentRequest_isEmergency_effectivePriority_idx" ON "public"."AppointmentRequest"("isEmergency", "effectivePriority");

-- CreateIndex
CREATE INDEX "AppointmentRequest_nextActionAt_idx" ON "public"."AppointmentRequest"("nextActionAt");

-- CreateIndex
CREATE INDEX "AppointmentRequestFollowUp_requestId_occurredAt_idx" ON "public"."AppointmentRequestFollowUp"("requestId", "occurredAt");

-- CreateIndex
CREATE INDEX "StaffEventInvolvement_eventId_idx" ON "public"."StaffEventInvolvement"("eventId");

-- CreateIndex
CREATE INDEX "StaffEventInvolvement_staffId_createdAt_idx" ON "public"."StaffEventInvolvement"("staffId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."PatientEvent" ADD CONSTRAINT "PatientEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PatientEvent" ADD CONSTRAINT "PatientEvent_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "public"."StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."PatientEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "public"."StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppointmentRequestFollowUp" ADD CONSTRAINT "AppointmentRequestFollowUp_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."AppointmentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppointmentRequestFollowUp" ADD CONSTRAINT "AppointmentRequestFollowUp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."PatientEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AppointmentRequestFollowUp" ADD CONSTRAINT "AppointmentRequestFollowUp_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StaffEventInvolvement" ADD CONSTRAINT "StaffEventInvolvement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."PatientEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StaffEventInvolvement" ADD CONSTRAINT "StaffEventInvolvement_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

