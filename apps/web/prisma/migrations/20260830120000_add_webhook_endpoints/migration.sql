-- Create the WebhookEndpoint table for handling notifications.
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secret" TEXT,
    "events" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- Index the enabled flag since the dispatcher will filter by it on every notification trigger.
CREATE INDEX "WebhookEndpoint_enabled_idx" ON "WebhookEndpoint"("enabled");
