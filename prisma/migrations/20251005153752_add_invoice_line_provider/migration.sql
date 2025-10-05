/*
  Manual migration to introduce provider assignment on invoice lines
*/

-- CreateEnum
CREATE TYPE "public"."PaymentMethodCategory" AS ENUM ('STANDARD', 'CUSTOMER_ACCOUNT');

-- add new columns in a safe order
ALTER TABLE "public"."InvoicePayment"
  ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dueAt" TIMESTAMP(3);

ALTER TABLE "public"."PaymentMethod"
  ADD COLUMN "category" "public"."PaymentMethodCategory" NOT NULL DEFAULT 'STANDARD';

-- add provider column as nullable first so existing rows survive
ALTER TABLE "public"."InvoiceLine" ADD COLUMN "providerStaffId" TEXT;

-- backfill existing invoice lines with a known clinical provider
UPDATE "public"."InvoiceLine"
SET "providerStaffId" = 'provider-default-id'
WHERE "providerStaffId" IS NULL;

-- enforce NOT NULL and foreign key / index
ALTER TABLE "public"."InvoiceLine"
  ALTER COLUMN "providerStaffId" SET NOT NULL;

CREATE INDEX "InvoiceLine_providerStaffId_idx"
  ON "public"."InvoiceLine"("providerStaffId");

ALTER TABLE "public"."InvoiceLine"
  ADD CONSTRAINT "InvoiceLine_providerStaffId_fkey"
  FOREIGN KEY ("providerStaffId") REFERENCES "public"."StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- index for payment status
CREATE INDEX "InvoicePayment_status_idx" ON "public"."InvoicePayment"("status");
