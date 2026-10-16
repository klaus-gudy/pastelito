import { Prisma } from "@/lib/generated/prisma/client"
import type {
  CashDirection,
  CashJournalKind,
  CashJournalRef,
  PaymentMethod,
} from "@/lib/generated/prisma/client"

// Writes the cash journal, the append-only audit trail of every movement of
// cash. Call these inside the Serializable transaction that makes the change,
// so the record and its journal row are saved together and two writers can't
// both read the same last balance.

const { Decimal } = Prisma

type Tx = Prisma.TransactionClient

const prefixes: Record<CashJournalRef, string> = {
  CAPITAL: "CAP",
  EXPENSE: "EXP",
  PURCHASE: "PUR",
  SALE: "SALE",
}

/** A short, readable reference for a record, e.g. SALE-7K2Q9X. */
export function journalReference(refType: CashJournalRef, refId: string) {
  return `${prefixes[refType]}-${refId.slice(-6).toUpperCase()}`
}

const moneyIn: CashJournalKind[] = ["CAPITAL_RECEIVED", "SALE_PAYMENT"]

export type CashMovement = {
  kind: Exclude<CashJournalKind, "REVERSAL">
  /** Positive; the kind says which way it moves. */
  amount: Prisma.Decimal | string | number
  occurredAt: Date
  method: PaymentMethod | null
  refType: CashJournalRef
  refId: string
  /** The payment within a sale, when there is one. */
  lineId?: string | null
  description: string
}

/** The record (or one payment of a sale) a set of journal rows belongs to. */
export type JournalRef = {
  refType: CashJournalRef
  refId: string
  /** Only this payment's rows; leave out for every row of the record. */
  lineId?: string
}

async function append(
  tx: Tx,
  userId: string,
  row: Omit<CashMovement, "kind" | "amount"> & {
    kind: CashJournalKind
    direction: CashDirection
    amount: Prisma.Decimal
    reversesId?: string
  }
) {
  const last = await tx.cashJournalEntry.findFirst({
    where: { userId },
    orderBy: { seq: "desc" },
    select: { seq: true, balanceAfter: true },
  })
  const change = row.direction === "DEBIT" ? row.amount : row.amount.neg()
  return tx.cashJournalEntry.create({
    data: {
      ...row,
      userId,
      lineId: row.lineId ?? null,
      reference: journalReference(row.refType, row.refId),
      seq: (last?.seq ?? 0) + 1,
      balanceAfter: (last?.balanceAfter ?? new Decimal(0)).add(change),
    },
  })
}

/** Records one movement of cash. A zero amount moves nothing and is skipped. */
export async function postCash(tx: Tx, userId: string, movement: CashMovement) {
  const amount = new Decimal(movement.amount)
  if (amount.isZero()) return null
  if (amount.lt(0)) throw new Error("Journal amounts are positive.")
  return append(tx, userId, {
    ...movement,
    amount,
    direction: moneyIn.includes(movement.kind) ? "DEBIT" : "CREDIT",
  })
}

/** Rows for a record that still stand: not reversals, and not reversed. */
function liveRows(tx: Tx, userId: string, ref: JournalRef) {
  return tx.cashJournalEntry.findMany({
    where: {
      userId,
      refType: ref.refType,
      refId: ref.refId,
      ...(ref.lineId !== undefined && { lineId: ref.lineId }),
      kind: { not: "REVERSAL" },
      reversedBy: { is: null },
    },
    orderBy: { seq: "asc" },
  })
}

/**
 * Cancels a record's rows that still stand, each with an opposite REVERSAL
 * row on the same business date, because the record was changed or deleted.
 */
export async function reverseCash(
  tx: Tx,
  userId: string,
  ref: JournalRef,
  reason: string
) {
  for (const row of await liveRows(tx, userId, ref)) {
    await append(tx, userId, {
      kind: "REVERSAL",
      direction: row.direction === "DEBIT" ? "CREDIT" : "DEBIT",
      amount: row.amount,
      occurredAt: row.occurredAt,
      method: row.method,
      refType: row.refType,
      refId: row.refId,
      lineId: row.lineId,
      description: `Reversed: ${row.description} (${reason})`,
      reversesId: row.id,
    })
  }
}

/**
 * Records a corrected movement: when its amount, date or method differs from
 * what the journal holds for the record, the old rows are reversed and the
 * new one posted. Any other change, such as a note, moves no cash and adds
 * nothing.
 */
export async function replaceCash(
  tx: Tx,
  userId: string,
  movement: CashMovement,
  reason: string
) {
  const ref = {
    refType: movement.refType,
    refId: movement.refId,
    ...(movement.lineId && { lineId: movement.lineId }),
  }
  const rows = await liveRows(tx, userId, ref)
  const [row] = rows
  const unchanged =
    rows.length === 1 &&
    row.kind === movement.kind &&
    row.amount.eq(movement.amount) &&
    row.occurredAt.getTime() === movement.occurredAt.getTime() &&
    row.method === movement.method
  if (unchanged) return
  await reverseCash(tx, userId, ref, reason)
  await postCash(tx, userId, movement)
}
