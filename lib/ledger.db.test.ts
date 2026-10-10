import { randomUUID } from "node:crypto"

import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { Prisma } from "@/lib/generated/prisma/client"
import {
  LedgerError,
  cancelSale,
  completeSale,
  recordCompletedSale,
  recordPayment,
  recordPreorder,
  recordReceivedPurchase,
  weightedAverageCost,
} from "@/lib/ledger"
import { prisma } from "@/lib/prisma"
import { businessSummary } from "@/lib/reports"

// Runs against TEST_DATABASE_URL (see vitest.config.ts). Every test gets a
// fresh user, so tests can't see each other's rows.

const day = new Date("2026-10-01T00:00:00+03:00")
const later = new Date("2026-10-05T00:00:00+03:00")

let userId: string

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: `ledger-${randomUUID()}@test.local` },
  })
  userId = user.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

async function addCapital(amount: number, owner = userId) {
  const source = await prisma.capitalSource.create({
    data: { userId: owner, name: "Owner", type: "OWNER" },
  })
  await prisma.capitalEntry.create({
    data: { userId: owner, sourceId: source.id, type: "RECEIVED", amount },
  })
}

async function addProduct(name = "Rose", owner = userId) {
  return prisma.product.create({
    data: { userId: owner, name, sizeMl: 50, sellingPrice: 40_000 },
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

function sell(
  productId: string,
  quantity: number,
  options: { unitPrice?: number; paid?: number; discount?: number } = {}
) {
  return recordCompletedSale(userId, {
    customerId: null,
    date: day,
    discount: options.discount ?? 0,
    note: null,
    items: [
      { productId, brand: null, quantity, unitPrice: options.unitPrice ?? 40_000 },
    ],
    payment:
      options.paid === undefined ? null : { amount: options.paid, method: "CASH" },
  })
}

async function stockOf(productId: string) {
  return prisma.product.findUniqueOrThrow({ where: { id: productId } })
}

async function cash() {
  return (await businessSummary(userId)).cash.toNumber()
}

describe("weightedAverageCost", () => {
  const { Decimal } = Prisma

  it("blends the old and new cost by quantity", () => {
    expect(
      weightedAverageCost(10, new Decimal(20_000), 10, new Decimal(30_000)).toNumber()
    ).toBe(25_000)
  })

  it("is the new cost when there was no stock", () => {
    expect(
      weightedAverageCost(0, new Decimal(0), 4, new Decimal(12_345)).toNumber()
    ).toBe(12_345)
  })
})

describe("purchases", () => {
  it("adds stock, sets the average cost and logs the movement", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()

    const purchase = await buy(product.id, 10, 20_000)
    await buy(product.id, 10, 30_000)

    const after = await stockOf(product.id)
    expect(after.quantityOnHand).toBe(20)
    expect(after.avgCost.toNumber()).toBe(25_000)
    expect(purchase.total.toNumber()).toBe(200_000)
    expect(await cash()).toBe(500_000)

    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id },
    })
    expect(movements.map((movement) => movement.quantity)).toEqual([10, 10])
  })

  it("reuses an existing supplier whatever its case", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await prisma.supplier.create({ data: { userId, name: "KARIAKOO IMPORTS" } })

    await buy(product.id, 1, 10_000)

    expect(await prisma.supplier.count({ where: { userId } })).toBe(1)
  })

  it("refuses to spend more cash than there is", async () => {
    await addCapital(100_000)
    const product = await addProduct()

    await expect(buy(product.id, 10, 20_000)).rejects.toThrow(/Not enough cash/)

    expect((await stockOf(product.id)).quantityOnHand).toBe(0)
    expect(await prisma.purchase.count({ where: { userId } })).toBe(0)
  })
})

describe("sales", () => {
  it("takes stock, snapshots the cost and leaves the unpaid part as debt", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 5, 20_000)

    const sale = await sell(product.id, 2, { paid: 50_000, discount: 5_000 })

    expect(sale.total.toNumber()).toBe(75_000)
    expect((await stockOf(product.id)).quantityOnHand).toBe(3)
    const item = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } })
    expect(item.unitCost.toNumber()).toBe(20_000)

    const summary = await businessSummary(userId)
    expect(summary.revenue.toNumber()).toBe(75_000)
    expect(summary.grossProfit.toNumber()).toBe(35_000)
    expect(summary.customerDebt.toNumber()).toBe(25_000)
    expect(summary.cash.toNumber()).toBe(1_000_000 - 100_000 + 50_000)
  })

  it("refuses to oversell and records nothing", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 1, 20_000)

    await expect(sell(product.id, 2)).rejects.toThrow(/Not enough stock/)

    expect((await stockOf(product.id)).quantityOnHand).toBe(1)
    expect(await prisma.sale.count({ where: { userId } })).toBe(0)
  })

  it("rejects a discount as large as the sale and a payment above the total", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 5, 20_000)

    await expect(sell(product.id, 1, { discount: 40_000 })).rejects.toThrow(
      LedgerError
    )
    await expect(sell(product.id, 1, { paid: 40_001 })).rejects.toThrow(
      /more than the sale total/
    )
  })

  it("sells the last unit only once when two sales race for it", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 1, 20_000)

    const results = await Promise.allSettled([
      sell(product.id, 1),
      sell(product.id, 1),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect((await stockOf(product.id)).quantityOnHand).toBe(0)
    expect(await prisma.sale.count({ where: { userId } })).toBe(1)
  })
})

describe("payments", () => {
  it("takes installments up to the balance and no further", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 1, 20_000)
    const sale = await sell(product.id, 1)

    await recordPayment(userId, sale.id, { amount: 30_000, method: "MOBILE_MONEY" })
    await expect(
      recordPayment(userId, sale.id, { amount: 10_001, method: "CASH" })
    ).rejects.toThrow(/more than the balance/)
    await recordPayment(userId, sale.id, { amount: 10_000, method: "CASH" })

    expect((await businessSummary(userId)).customerDebt.toNumber()).toBe(0)
  })

  it("rejects zero and payments on cancelled sales", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 1, 20_000)
    const sale = await sell(product.id, 1)

    await expect(
      recordPayment(userId, sale.id, { amount: 0, method: "CASH" })
    ).rejects.toThrow(/more than zero/)

    await prisma.sale.update({ where: { id: sale.id }, data: { status: "CANCELLED" } })
    await expect(
      recordPayment(userId, sale.id, { amount: 1_000, method: "CASH" })
    ).rejects.toThrow(/CANCELLED/)
  })
})

describe("preorders", () => {
  async function preorder(productId: string, deposit: number | null) {
    const customer = await prisma.customer.create({
      data: { userId, name: "Amina" },
    })
    return recordPreorder(userId, {
      customerId: customer.id,
      date: day,
      discount: 0,
      note: null,
      items: [{ productId, brand: "Lattafa", quantity: 2, unitPrice: 40_000 }],
      deposit: deposit === null ? null : { amount: deposit, method: "CASH" },
    })
  }

  it("takes no stock until delivered, then costs it at delivery", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    const order = await preorder(product.id, 20_000)

    expect((await stockOf(product.id)).quantityOnHand).toBe(0)
    expect(await cash()).toBe(1_020_000)

    // Not deliverable until the stock arrives.
    await expect(completeSale(userId, order.id)).rejects.toThrow(/Not enough stock/)

    await buy(product.id, 2, 15_000)
    const delivered = await completeSale(userId, order.id, {
      date: later,
      payment: { amount: 60_000, method: "CASH" },
    })

    expect(delivered.status).toBe("COMPLETED")
    expect(delivered.date).toEqual(later)
    expect((await stockOf(product.id)).quantityOnHand).toBe(0)
    const item = await prisma.saleItem.findFirstOrThrow({ where: { saleId: order.id } })
    expect(item.unitCost.toNumber()).toBe(15_000)
    expect((await businessSummary(userId)).customerDebt.toNumber()).toBe(0)
  })

  it("can't be delivered before it was ordered", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 2, 15_000)
    const order = await preorder(product.id, null)

    await expect(
      completeSale(userId, order.id, { date: new Date("2026-09-01") })
    ).rejects.toThrow(/before the order date/)
    expect((await stockOf(product.id)).quantityOnHand).toBe(2)
  })

  it("refunds the deposit on cancel, but only if cash covers it", async () => {
    const product = await addProduct()
    const order = await preorder(product.id, 30_000)

    // Spend the deposit on stock, leaving nothing to refund it from.
    await buy(product.id, 2, 15_000)
    expect(await cash()).toBe(0)
    await expect(cancelSale(userId, order.id)).rejects.toThrow(/Add capital first/)

    await addCapital(30_000)
    await cancelSale(userId, order.id)
    expect(await cash()).toBe(0)
  })

  it("can't be cancelled once delivered", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 2, 15_000)
    const order = await preorder(product.id, null)
    await completeSale(userId, order.id)

    await expect(cancelSale(userId, order.id)).rejects.toThrow(
      /from COMPLETED to CANCELLED/
    )
  })
})

describe("separate books", () => {
  it("never touches another user's records", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 1, 20_000)
    const sale = await sell(product.id, 1)

    const other = await prisma.user.create({
      data: { email: `other-${randomUUID()}@test.local` },
    })
    await expect(cancelSale(other.id, sale.id)).rejects.toThrow(/Sale not found/)
    await expect(
      recordPayment(other.id, sale.id, { amount: 1_000, method: "CASH" })
    ).rejects.toThrow(/Sale not found/)
    await expect(
      recordReceivedPurchase(other.id, {
        supplierName: null,
        date: day,
        method: "CASH",
        note: null,
        items: [{ productId: product.id, quantity: 1, unitCost: 0 }],
      })
    ).rejects.toThrow()
    expect((await stockOf(product.id)).quantityOnHand).toBe(0)
  })
})
