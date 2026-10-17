-- One signup grant per target; application idempotency enforced at DB level.
DELETE FROM "credit_ledger" AS older
USING "credit_ledger" AS newer
WHERE older."id" > newer."id"
  AND older."audience" = newer."audience"
  AND older."targetId" = newer."targetId"
  AND older."reason" = 'signup grant'
  AND newer."reason" = 'signup grant';

CREATE UNIQUE INDEX "credit_ledger_signup_grant_unique"
ON "credit_ledger" ("audience", "targetId")
WHERE "reason" = 'signup grant';
