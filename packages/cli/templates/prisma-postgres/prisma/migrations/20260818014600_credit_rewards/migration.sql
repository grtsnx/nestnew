ALTER TABLE "organization" ADD COLUMN "creditBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "team" ADD COLUMN "creditBalance" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "credit_ledger" (
    "id" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credit_ledger_audience_targetId_idx" ON "credit_ledger"("audience", "targetId");
