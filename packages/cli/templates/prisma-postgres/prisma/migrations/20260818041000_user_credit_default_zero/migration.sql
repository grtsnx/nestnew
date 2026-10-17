-- New users start with zero credits until email verification grants signup credits.
ALTER TABLE "user" ALTER COLUMN "creditBalance" SET DEFAULT 0;
