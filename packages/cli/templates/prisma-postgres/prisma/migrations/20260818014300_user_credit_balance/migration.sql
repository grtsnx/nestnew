-- Individual signup credits live on the user, not organisations or teams.
ALTER TABLE "user" ADD COLUMN "creditBalance" INTEGER NOT NULL DEFAULT 100;
