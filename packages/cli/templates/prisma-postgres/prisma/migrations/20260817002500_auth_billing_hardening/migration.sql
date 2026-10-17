-- Drop Subscription table (Stripe BA plugin)
DROP TABLE IF EXISTS "subscription";

-- User / Organization: drop Stripe customer ids
ALTER TABLE "user" DROP COLUMN IF EXISTS "stripeCustomerId";
ALTER TABLE "organization" DROP COLUMN IF EXISTS "stripeCustomerId";

-- Plan: replace Stripe price fields with Autumn product id
ALTER TABLE "plan" DROP COLUMN IF EXISTS "stripeProductId";
ALTER TABLE "plan" DROP COLUMN IF EXISTS "stripePriceId";
ALTER TABLE "plan" DROP COLUMN IF EXISTS "stripeAnnualPriceId";
ALTER TABLE "plan" DROP COLUMN IF EXISTS "seatPriceId";
ALTER TABLE "plan" ADD COLUMN IF NOT EXISTS "autumnProductId" TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS "session_userId_expiresAt_idx" ON "session"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "verification_expiresAt_idx" ON "verification"("expiresAt");
CREATE INDEX IF NOT EXISTS "invitation_status_expiresAt_idx" ON "invitation"("status", "expiresAt");

-- Uniques (dedupe first if needed — assume clean data)
CREATE UNIQUE INDEX IF NOT EXISTS "account_providerId_accountId_key" ON "account"("providerId", "accountId");
CREATE UNIQUE INDEX IF NOT EXISTS "member_organizationId_userId_key" ON "member"("organizationId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "teamMember_teamId_userId_key" ON "teamMember"("teamId", "userId");
