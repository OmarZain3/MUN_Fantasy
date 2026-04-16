-- CreateTable
CREATE TABLE "LeagueSettings" (
    "id" TEXT NOT NULL,
    "transferMarketOpen" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "LeagueSettings" ("id", "transferMarketOpen", "updatedAt")
VALUES ('default', true, CURRENT_TIMESTAMP);
