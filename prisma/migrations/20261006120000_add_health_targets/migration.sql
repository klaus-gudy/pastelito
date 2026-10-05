-- CreateTable
CREATE TABLE "HealthTargets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marginPct" INTEGER,
    "collectionPct" INTEGER,
    "salesTrendPct" INTEGER,
    "stockMaxDays" INTEGER,
    "paybackPct" INTEGER,
    "overdueDays" INTEGER,
    "repeatPct" INTEGER,
    "preorderMaxDays" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthTargets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthTargets_userId_key" ON "HealthTargets"("userId");

-- AddForeignKey
ALTER TABLE "HealthTargets" ADD CONSTRAINT "HealthTargets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

