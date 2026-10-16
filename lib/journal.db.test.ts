import { randomUUID } from "node:crypto"

import { afterAll, beforeEach, describe, expect, it } from "vitest"

import {
  cancelSale,
  deletePayment,
  deletePurchase,
  deleteSale,
  recordCompletedSale,
  recordPayment,
  recordPreorder,
  recordReceivedPurchase,
  recordSaleReturn,
  serializable,
  updatePayment,
} from "@/lib/ledger"
import { postCash, replaceCash, reverseCash } from "@/lib/journal"
import { prisma } from "@/lib/prisma"
import { businessSummary } from "@/lib/reports"

// Runs against TEST_DATABASE_URL, a fresh user per test, like the ledger tests.

const day = new Date("2026-10-01T00:00:00+03:00")
const later = new Date("2026-10-05T00:00:00+03:00")

let userId: string

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: `journal-${randomUUID()}@test.local` },
  })
  userId = user.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

/** Adds capital the way the capital actions do: entry and journal row together. */
function addCapital(amount: number) {
  return serializable(async (tx) => {
    const source = await tx.capitalSource.create({
      data: { userId, name: "Owner", type: "OWNER" },
    })
    const entry = await tx.capitalEntry.create({
      data: { userId, sourceId: source.id, type: "RECEIVED", amount, date: day },
    })
    await postCash(tx, userId, {
      kind: "CAPITAL_RECEIVED",
      amount,
      occurredAt: entry.date,
      method: entry.method,
      refType: "CAPITAL",
      refId: entry.id,
      description: "Capital from Owner",
    })
    return entry
  })
}

async function addProduct(name = "Rose") {
  return prisma.product.create({
    data: { userId, name, sizeMl: 50, sellingPrice: 40_000 },
  })
}

function buy(productId: string, quantity: number, unitCost: number) {
  return recordReceivedPurchase(userId, {
    supplierName: "Kariakoo Imports",
    date: day,
    method: "CASH",
    note: null,
    items: [{ productId, quantity, unitCost }],
  })
}

function sell(productId: string, quantity: number, paid: number) {
  return recordCompletedSale(userId, {
    customerId: null,
    date: day,
    discount: 0,
    note: null,
    items: [{ productId, brand: null, quantity, unitPrice: 40_000 }],
    payment: paid > 0 ? { amount: paid, method: "CASH" } : null,
  })
}

const journal = () =>
  prisma.cashJournalEntry.findMany({
    where: { userId },
    orderBy: { seq: "asc" },
  })

/** The journal's last balance is the cash the app computes, with no gaps. */
async function expectReconciled() {
  const rows = await journal()
  const { cash } = await businessSummary(userId)
  expect(rows.map((row) => row.seq)).toEqual(rows.map((_, i) => i + 1))
  expect((rows.at(-1)?.balanceAfter ?? 0).toString()).toBe(cash.toString())
  return rows
}

describe("cash journal", () => {
  it("matches cash after every kind of money movement", async () => {
    await addCapital(1_000_000)
    const rose = await addProduct("Rose")
    const oud = await addProduct("Oud")

    await buy(rose.id, 10, 20_000)
    await expectReconciled()

    const sale = await sell(rose.id, 2, 50_000)
    await expectReconciled()

    const payment = await recordPayment(userId, sale.id, {
      amount: 20_000,
      method: "MOBILE_MONEY",
      paidAt: later,
    })
    await expectReconciled()

    await updatePayment(userId, payment.id, {
      amount: 30_000,
      method: "MOBILE_MONEY",
      paidAt: later,
      note: null,
    })
    await expectReconciled()

    const items = await prisma.saleItem.findMany({ where: { saleId: sale.id } })
    await recordSaleReturn(userId, sale.id, {
      items: [{ saleItemId: items[0].id, quantity: 1 }],
      date: later,
      method: "CASH",
      note: null,
    })
    await expectReconciled()

    const customer = await prisma.customer.create({
      data: { userId, name: "Amina" },
    })
    const preorder = await recordPreorder(userId, {
      customerId: customer.id,
      date: day,
      discount: 0,
      note: null,
      items: [{ productId: oud.id, brand: null, quantity: 1, unitPrice: 60_000 }],
      deposit: { amount: 15_000, method: "CASH" },
    })
    await expectReconciled()
    await cancelSale(userId, preorder.id)
    await expectReconciled()

    const second = await sell(rose.id, 1, 0)
    const extra = await recordPayment(userId, second.id, {
      amount: 10_000,
      method: "CASH",
    })
    await deletePayment(userId, extra.id)
    await expectReconciled()

    const oudPurchase = await buy(oud.id, 3, 25_000)
    await deletePurchase(userId, oudPurchase.id)
    await expectReconciled()

    await deleteSale(userId, sale.id)
    const rows = await expectReconciled()

    expect(rows.map((row) => row.kind)).toEqual([
      "CAPITAL_RECEIVED",
      "PURCHASE",
      "SALE_PAYMENT",
      "SALE_PAYMENT",
      // The edited payment: the old row reversed, then the new one.
      "REVERSAL",
      "SALE_PAYMENT",
      "REFUND",
      "SALE_PAYMENT",
      "REFUND",
      "SALE_PAYMENT",
      "REVERSAL",
      "PURCHASE",
      "REVERSAL",
      // Deleting the sale reverses each of its rows that still stood.
      "REVERSAL",
      "REVERSAL",
      "REVERSAL",
    ])
  })

  it("records direction, balance and a reference for each row", async () => {
    await addCapital(500_000)
    const rose = await addProduct()
    const purchase = await buy(rose.id, 5, 40_000)

    const [capital, bought] = await journal()
    expect(capital).toMatchObject({ direction: "DEBIT", seq: 1 })
    expect(capital.balanceAfter.toString()).toBe("500000")
    expect(bought).toMatchObject({
      kind: "PURCHASE",
      direction: "CREDIT",
      refType: "PURCHASE",
      refId: purchase.id,
      reference: `PUR-${purchase.id.slice(-6).toUpperCase()}`,
      description: "Purchase from Kariakoo Imports",
    })
    expect(bought.amount.toString()).toBe("200000")
    expect(bought.balanceAfter.toString()).toBe("300000")
  })

  it("links a reversal to the row it cancels, once", async () => {
    await addCapital(500_000)
    const rose = await addProduct()
    const purchase = await buy(rose.id, 5, 40_000)
    await deletePurchase(userId, purchase.id)

    const ref = { refType: "PURCHASE" as const, refId: purchase.id }
    // Already reversed, so reversing again adds nothing.
    await serializable((tx) => reverseCash(tx, userId, ref, "again"))

    const [, bought, reversal] = await journal()
    expect(await journal()).toHaveLength(3)
    expect(reversal).toMatchObject({
      kind: "REVERSAL",
      direction: "DEBIT",
      reversesId: bought.id,
      occurredAt: bought.occurredAt,
      description: "Reversed: Purchase from Kariakoo Imports (purchase deleted)",
    })
  })

  it("adds nothing when a correction doesn't move cash", async () => {
    const entry = await addCapital(500_000)
    await serializable((tx) =>
      replaceCash(
        tx,
        userId,
        {
          kind: "CAPITAL_RECEIVED",
          amount: 500_000,
          occurredAt: entry.date,
          method: entry.method,
          refType: "CAPITAL",
          refId: entry.id,
          description: "Capital from a renamed source",
        },
        "entry edited"
      )
    )
    expect(await journal()).toHaveLength(1)
  })

  it("refuses to change or delete rows, but goes with its user", async () => {
    await addCapital(500_000)
    const [row] = await journal()

    await expect(
      prisma.cashJournalEntry.update({
        where: { id: row.id },
        data: { amount: 1 },
      })
    ).rejects.toThrow(/append-only/)
    await expect(
      prisma.cashJournalEntry.delete({ where: { id: row.id } })
    ).rejects.toThrow(/append-only/)

    await prisma.user.delete({ where: { id: userId } })
    expect(await journal()).toHaveLength(0)
  })
})
