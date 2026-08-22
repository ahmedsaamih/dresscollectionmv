-- Delivery-tracking log for outbound customer notifications (email + SMS).
CREATE TABLE "NotificationLog" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "orderRef" TEXT,
  "recipient" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "error" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationLog_channel_idx" ON "NotificationLog"("channel");
CREATE INDEX "NotificationLog_orderRef_idx" ON "NotificationLog"("orderRef");
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");
