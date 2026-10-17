-- Better Auth 1.7: account identity is scoped by (issuer, accountId).

ALTER TABLE "account" ADD COLUMN "issuer" TEXT;

UPDATE "account"
SET "issuer" = 'local:credential'
WHERE "providerId" = 'credential';

UPDATE "account"
SET "issuer" = 'local:oauth:' || "providerId"
WHERE "issuer" IS NULL;

ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;

DROP INDEX IF EXISTS "account_providerId_accountId_key";

CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
