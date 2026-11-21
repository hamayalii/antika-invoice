-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- AlterTable invoices
ALTER TABLE "invoices"
  ADD COLUMN "verify_code" TEXT,
  ADD COLUMN "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "issued_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "cancel_reason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "integrity_hash" TEXT,
  ADD COLUMN "verify_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_verified_at" TIMESTAMP(3),
  ADD COLUMN "watermark_enabled" BOOLEAN;

UPDATE "invoices"
SET "verify_code" = regexp_replace(
  upper(substr(translate(md5(random()::text || id::text || clock_timestamp()::text), '01OI', ''), 1, 12)),
  '(.{4})(.{4})(.{4})',
  '\1-\2-\3'
)
WHERE "verify_code" IS NULL;

ALTER TABLE "invoices" ALTER COLUMN "verify_code" SET NOT NULL;
CREATE UNIQUE INDEX "invoices_verify_code_key" ON "invoices"("verify_code");
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- AlterTable vouchers
ALTER TABLE "vouchers"
  ADD COLUMN "verify_code" TEXT,
  ADD COLUMN "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "issued_at" TIMESTAMP(3),
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "cancel_reason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "integrity_hash" TEXT,
  ADD COLUMN "verify_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_verified_at" TIMESTAMP(3),
  ADD COLUMN "watermark_enabled" BOOLEAN;

UPDATE "vouchers"
SET "verify_code" = regexp_replace(
  upper(substr(translate(md5(random()::text || id::text || clock_timestamp()::text), '01OI', ''), 1, 12)),
  '(.{4})(.{4})(.{4})',
  '\1-\2-\3'
)
WHERE "verify_code" IS NULL;

ALTER TABLE "vouchers" ALTER COLUMN "verify_code" SET NOT NULL;
CREATE UNIQUE INDEX "vouchers_verify_code_key" ON "vouchers"("verify_code");
CREATE INDEX "vouchers_status_idx" ON "vouchers"("status");
