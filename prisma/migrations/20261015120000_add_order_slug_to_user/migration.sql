-- AlterTable
ALTER TABLE "User" ADD COLUMN     "orderSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_orderSlug_key" ON "User"("orderSlug");
