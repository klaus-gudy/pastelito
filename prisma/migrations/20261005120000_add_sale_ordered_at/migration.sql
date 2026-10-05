-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "orderedAt" TIMESTAMP(3);

-- Preorders taken so far were ordered on their sale date.
UPDATE "Sale" SET "orderedAt" = "date" WHERE "status" = 'PREORDER';
