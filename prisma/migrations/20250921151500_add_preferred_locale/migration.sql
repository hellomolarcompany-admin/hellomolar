-- CreateEnum
CREATE TYPE "public"."LocaleCode" AS ENUM ('nl', 'en', 'es', 'pap');

-- AlterTable
ALTER TABLE "public"."Patient" ADD COLUMN     "preferredLocale" "public"."LocaleCode";

-- AlterTable
ALTER TABLE "public"."AppointmentRequest" ADD COLUMN     "preferredLocale" "public"."LocaleCode" NOT NULL DEFAULT 'en';

