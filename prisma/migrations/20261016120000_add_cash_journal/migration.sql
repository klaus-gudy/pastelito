-- CreateEnum
CREATE TYPE "CashJournalKind" AS ENUM ('CAPITAL_RECEIVED', 'CAPITAL_REPAID', 'PURCHASE', 'EXPENSE', 'SALE_PAYMENT', 'REFUND', 'REVERSAL');

-- CreateEnum
CREATE TYPE "CashDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "CashJournalRef" AS ENUM ('CAPITAL', 'EXPENSE', 'PURCHASE', 'SALE');

-- CreateTable
CREATE TABLE "CashJournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "CashJournalKind" NOT NULL,
    "direction" "CashDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod",
    "refType" "CashJournalRef" NOT NULL,
    "refId" TEXT NOT NULL,
    "lineId" TEXT,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reversesId" TEXT,

    CONSTRAINT "CashJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashJournalEntry_reversesId_key" ON "CashJournalEntry"("reversesId");

-- CreateIndex
CREATE INDEX "CashJournalEntry_userId_occurredAt_idx" ON "CashJournalEntry"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "CashJournalEntry_userId_refType_refId_idx" ON "CashJournalEntry"("userId", "refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "CashJournalEntry_userId_seq_key" ON "CashJournalEntry"("userId", "seq");

-- AddForeignKey
ALTER TABLE "CashJournalEntry" ADD CONSTRAINT "CashJournalEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "CashJournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashJournalEntry" ADD CONSTRAINT "CashJournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "CashJournalEntry" ADD CONSTRAINT "CashJournalEntry_amount_positive" CHECK ("amount" > 0);

-- Append-only: rows can't be changed or deleted, except when their user is
-- deleted (the cascade from "User", which by then no longer sees the user).
CREATE FUNCTION "cash_journal_append_only"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' OR EXISTS (SELECT 1 FROM "User" WHERE "id" = OLD."userId") THEN
    RAISE EXCEPTION 'The cash journal is append-only: % is not allowed. Record a reversal instead.', TG_OP;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cash_journal_append_only"
BEFORE UPDATE OR DELETE ON "CashJournalEntry"
FOR EACH ROW EXECUTE FUNCTION "cash_journal_append_only"();

CREATE TRIGGER "cash_journal_no_truncate"
BEFORE TRUNCATE ON "CashJournalEntry"
FOR EACH STATEMENT EXECUTE FUNCTION "cash_journal_append_only"();

-- Backfill: replays the money already recorded, by business date, so the
-- journal starts with the history behind today's cash. Within a day, money
-- in comes before money out. Each user's last balanceAfter equals the cash
-- the app computes. Payments on a cancelled sale are followed by their
-- refund, dated on the last payment since the cancel date isn't stored.
WITH events AS (
  SELECT
    e."userId",
    e."date" AS "occurredAt",
    CASE e."type" WHEN 'RECEIVED' THEN 0 ELSE 4 END AS "ord",
    (CASE e."type" WHEN 'RECEIVED' THEN 'CAPITAL_RECEIVED' ELSE 'CAPITAL_REPAID' END)::"CashJournalKind" AS "kind",
    (CASE e."type" WHEN 'RECEIVED' THEN 'DEBIT' ELSE 'CREDIT' END)::"CashDirection" AS "direction",
    e."amount",
    e."method",
    'CAPITAL'::"CashJournalRef" AS "refType",
    e."id" AS "refId",
    NULL::TEXT AS "lineId",
    'CAP-' || upper(right(e."id", 6)) AS "reference",
    (CASE e."type" WHEN 'RECEIVED' THEN 'Capital from ' ELSE 'Repaid ' END) || s."name" AS "description"
  FROM "CapitalEntry" e
  JOIN "CapitalSource" s ON s."id" = e."sourceId"

  UNION ALL
  SELECT
    p."userId", p."date", 2, 'PURCHASE', 'CREDIT', p."total", p."method",
    'PURCHASE', p."id", NULL,
    'PUR-' || upper(right(p."id", 6)),
    COALESCE('Purchase from ' || s."name", 'Purchase')
  FROM "Purchase" p
  LEFT JOIN "Supplier" s ON s."id" = p."supplierId"
  WHERE p."status" = 'RECEIVED' AND p."total" > 0

  UNION ALL
  SELECT
    x."userId", x."date", 2, 'EXPENSE', 'CREDIT', x."amount", x."method",
    'EXPENSE', x."id", NULL,
    'EXP-' || upper(right(x."id", 6)),
    (CASE x."category"
      WHEN 'RENT' THEN 'Rent'
      WHEN 'TRANSPORT' THEN 'Transport'
      WHEN 'PACKAGING' THEN 'Packaging'
      WHEN 'MARKETING' THEN 'Marketing'
      WHEN 'UTILITIES' THEN 'Utilities'
      WHEN 'SALARIES' THEN 'Salaries'
      WHEN 'FEES' THEN 'Fees and taxes'
      WHEN 'OTHER' THEN 'Other'
      ELSE x."category"
    END) || ' expense' || COALESCE(': ' || NULLIF(x."description", ''), '')
  FROM "Expense" x

  UNION ALL
  SELECT
    sa."userId", pay."paidAt",
    CASE WHEN pay."amount" > 0 THEN 1 ELSE 3 END,
    (CASE WHEN pay."amount" > 0 THEN 'SALE_PAYMENT' ELSE 'REFUND' END)::"CashJournalKind",
    (CASE WHEN pay."amount" > 0 THEN 'DEBIT' ELSE 'CREDIT' END)::"CashDirection",
    abs(pay."amount"), pay."method",
    'SALE', sa."id", pay."id",
    'SALE-' || upper(right(sa."id", 6)),
    (CASE WHEN pay."amount" > 0 THEN 'Payment from ' ELSE 'Refund to ' END)
      || COALESCE(c."name", 'walk-in customer')
  FROM "Payment" pay
  JOIN "Sale" sa ON sa."id" = pay."saleId"
  LEFT JOIN "Customer" c ON c."id" = sa."customerId"
  WHERE sa."status" IN ('PREORDER', 'COMPLETED', 'CANCELLED') AND pay."amount" <> 0

  UNION ALL
  SELECT
    sa."userId", max(pay."paidAt"), 3, 'REFUND', 'CREDIT', sum(pay."amount"), NULL,
    'SALE', sa."id", NULL,
    'SALE-' || upper(right(sa."id", 6)),
    'Refund to ' || COALESCE(max(c."name"), 'walk-in customer') || ', sale cancelled'
  FROM "Sale" sa
  JOIN "Payment" pay ON pay."saleId" = sa."id"
  LEFT JOIN "Customer" c ON c."id" = sa."customerId"
  WHERE sa."status" = 'CANCELLED'
  GROUP BY sa."id", sa."userId"
  HAVING sum(pay."amount") > 0
),
ordered AS (
  SELECT
    events.*,
    row_number() OVER w AS "seq",
    sum(CASE "direction" WHEN 'DEBIT' THEN "amount" ELSE -"amount" END) OVER w AS "balanceAfter"
  FROM events
  WINDOW w AS (
    PARTITION BY "userId"
    ORDER BY "occurredAt", "ord", "refId", "lineId" NULLS LAST
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )
)
INSERT INTO "CashJournalEntry" (
  "id", "userId", "seq", "occurredAt", "kind", "direction", "amount",
  "balanceAfter", "method", "refType", "refId", "lineId", "reference",
  "description"
)
SELECT
  gen_random_uuid()::TEXT, "userId", "seq", "occurredAt", "kind", "direction",
  "amount", "balanceAfter", "method", "refType", "refId", "lineId",
  "reference", "description"
FROM ordered;
