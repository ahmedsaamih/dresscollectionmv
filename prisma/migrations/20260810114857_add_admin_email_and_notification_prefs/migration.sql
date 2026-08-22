-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "adminEmail" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "NotificationChannelPref" (
    "event" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationChannelPref_pkey" PRIMARY KEY ("event")
);

-- Seed one row per customer-facing notification event, both channels
-- enabled, so the admin UI has real rows to render/toggle against.
INSERT INTO "NotificationChannelPref" ("event", "emailEnabled", "smsEnabled") VALUES
  ('orderPlaced', true, true),
  ('orderPaymentConfirmed', true, true),
  ('quoteRequested', true, true),
  ('quotePriced', true, true),
  ('orderStatusUpdated', true, true),
  ('quoteConfirmationRequested', true, true),
  ('quoteConfirmed', true, true),
  ('quoteRejected', true, true)
ON CONFLICT ("event") DO NOTHING;
