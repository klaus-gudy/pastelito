import { randomUUID } from "node:crypto"

import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { Prisma } from "@/lib/generated/prisma/client"
import {
  LedgerError,
  adjustStock,
  averageCostWithout,
  cancelSale,
  completeSale,
  deletePayment,
  deletePurchase,
  deleteSale,
  recordCompletedSale,
  recordPayment,
  recordPreorder,
  recordReceivedPurchase,
  recordSaleReturn,
  undoStockAdjustment,
  updatePayment,
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

  it("brings back a deleted supplier of the same name", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    const deleted = await prisma.supplier.create({
      data: { userId, name: "Kariakoo Imports", deletedAt: new Date() },
    })

    const purchase = await buy(product.id, 1, 10_000)

    expect(purchase.supplierId).toBe(deleted.id)
    const supplier = await prisma.supplier.findUniqueOrThrow({
      where: { id: deleted.id },
    })
    expect(supplier.deletedAt).toBeNull()
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

describe("averageCostWithout", () => {
  const { Decimal } = Prisma

  it("undoes weightedAverageCost", () => {
    expect(
      averageCostWithout(20, new Decimal(25_000), 10, new Decimal(30_000)).toNumber()
    ).toBe(20_000)
  })

  it("keeps the average when nothing is left", () => {
    expect(
      averageCostWithout(4, new Decimal(12_000), 4, new Decimal(12_000)).toNumber()
    ).toBe(12_000)
  })
})

describe("corrections", () => {
  it("deletes a purchase, taking its stock, cost and cash back", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 10, 20_000)
    const mistake = await buy(product.id, 10, 30_000)

    await deletePurchase(userId, mistake.id)

    const after = await stockOf(product.id)
    expect(after.quantityOnHand).toBe(10)
    expect(after.avgCost.toNumber()).toBe(20_000)
    expect(await cash()).toBe(800_000)
    expect(await prisma.purchase.count({ where: { id: mistake.id } })).toBe(0)
    expect(
      await prisma.stockMovement.count({ where: { refId: mistake.id } })
    ).toBe(0)
  })

  it("won't delete a purchase whose stock is partly sold", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    const purchase = await buy(product.id, 2, 20_000)
    await sell(product.id, 1)

    await expect(deletePurchase(userId, purchase.id)).rejects.toThrow(
      /already sold/
    )
    expect((await stockOf(product.id)).quantityOnHand).toBe(1)
  })

  it("deletes a sale, restocking and taking its payments out of cash", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 5, 20_000)
    const sale = await sell(product.id, 2, { paid: 50_000 })

    await deleteSale(userId, sale.id)

    expect((await stockOf(product.id)).quantityOnHand).toBe(5)
    const summary = await businessSummary(userId)
    expect(summary.revenue.toNumber()).toBe(0)
    expect(summary.customerDebt.toNumber()).toBe(0)
    expect(summary.cash.toNumber()).toBe(900_000)
    expect(await prisma.payment.count({ where: { saleId: sale.id } })).toBe(0)
    expect(await prisma.stockMovement.count({ where: { refId: sale.id } })).toBe(0)
  })

  it("deletes a sale that had a return without counting the return twice", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 5, 20_000)
    const sale = await sell(product.id, 3, { paid: 120_000 })
    const item = await prisma.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    })
    await recordSaleReturn(userId, sale.id, {
      items: [{ saleItemId: item.id, quantity: 1 }],
      date: later,
      method: "CASH",
      note: null,
    })

    await deleteSale(userId, sale.id)

    expect((await stockOf(product.id)).quantityOnHand).toBe(5)
    expect(await cash()).toBe(900_000)
    expect(
      await prisma.stockMovement.count({ where: { productId: product.id } })
    ).toBe(1)
  })

  it("corrects a payment within the sale total", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 1, 20_000)
    const sale = await sell(product.id, 1, { paid: 10_000 })
    const payment = await prisma.payment.findFirstOrThrow({
      where: { saleId: sale.id },
    })

    await expect(
      updatePayment(userId, payment.id, {
        amount: 50_000,
        method: "CASH",
        paidAt: day,
        note: null,
      })
    ).rejects.toThrow(/At most/)
    await updatePayment(userId, payment.id, {
      amount: 30_000,
      method: "MOBILE_MONEY",
      paidAt: later,
      note: "Fixed",
    })

    expect((await businessSummary(userId)).customerDebt.toNumber()).toBe(10_000)
  })

  it("deletes a payment but never a refund", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 2, 20_000)
    const sale = await sell(product.id, 2, { paid: 80_000 })
    const item = await prisma.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    })
    await recordSaleReturn(userId, sale.id, {
      items: [{ saleItemId: item.id, quantity: 1 }],
      date: later,
      method: "CASH",
      note: null,
    })
    const refund = await prisma.payment.findFirstOrThrow({
      where: { saleId: sale.id, amount: { lt: 0 } },
    })
    const paid = await prisma.payment.findFirstOrThrow({
      where: { saleId: sale.id, amount: { gt: 0 } },
    })

    await expect(deletePayment(userId, refund.id)).rejects.toThrow(/refund/)
    await expect(deletePayment(userId, paid.id)).rejects.toThrow(/refunded/)

    const other = await sell(product.id, 1, { paid: 40_000 })
    const otherPayment = await prisma.payment.findFirstOrThrow({
      where: { saleId: other.id },
    })
    await deletePayment(userId, otherPayment.id)
    expect((await businessSummary(userId)).customerDebt.toNumber()).toBe(40_000)
  })

  it("never corrects another user's records", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    const purchase = await buy(product.id, 2, 20_000)
    const sale = await sell(product.id, 1, { paid: 40_000 })
    const payment = await prisma.payment.findFirstOrThrow({
      where: { saleId: sale.id },
    })

    const other = await prisma.user.create({
      data: { email: `other-${randomUUID()}@test.local` },
    })
    await expect(deletePurchase(other.id, purchase.id)).rejects.toThrow(
      /no longer exists/
    )
    await expect(deleteSale(other.id, sale.id)).rejects.toThrow(/no longer exists/)
    await expect(deletePayment(other.id, payment.id)).rejects.toThrow(
      /no longer exists/
    )
  })
})

describe("returns", () => {
  async function returnUnits(saleId: string, quantity: number) {
    const item = await prisma.saleItem.findFirstOrThrow({ where: { saleId } })
    return recordSaleReturn(userId, saleId, {
      items: [{ saleItemId: item.id, quantity }],
      date: later,
      method: "CASH",
      note: null,
    })
  }

  it("refunds a paid sale, restocks and reduces revenue and cost", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 5, 20_000)
    const sale = await sell(product.id, 3, { paid: 120_000 })

    const result = await returnUnits(sale.id, 1)

    expect(result).toMatchObject({ credit: 40_000, refund: 40_000 })
    expect((await stockOf(product.id)).quantityOnHand).toBe(3)
    const summary = await businessSummary(userId)
    expect(summary.revenue.toNumber()).toBe(80_000)
    expect(summary.costOfGoodsSold.toNumber()).toBe(40_000)
    expect(summary.customerDebt.toNumber()).toBe(0)
    expect(summary.cash.toNumber()).toBe(1_000_000 - 100_000 + 80_000)
    const refund = await prisma.payment.findFirstOrThrow({
      where: { saleId: sale.id, amount: { lt: 0 } },
    })
    expect(refund.amount.toNumber()).toBe(-40_000)
    expect(refund.paidAt).toEqual(later)
  })

  it("clears debt before refunding on an unpaid sale", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 5, 20_000)
    const sale = await sell(product.id, 3, { paid: 20_000 })

    const result = await returnUnits(sale.id, 1)

    expect(result).toMatchObject({ credit: 40_000, refund: 0 })
    expect((await businessSummary(userId)).customerDebt.toNumber()).toBe(60_000)
    expect(await prisma.payment.count({ where: { saleId: sale.id } })).toBe(1)
  })

  it("shares the discount when part of a discounted sale comes back", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 5, 20_000)
    const sale = await sell(product.id, 2, { discount: 10_000, paid: 70_000 })

    const result = await returnUnits(sale.id, 1)

    expect(result).toMatchObject({ credit: 35_000, refund: 35_000 })
    const after = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })
    expect(after.total.toNumber()).toBe(35_000)
    expect(after.discount.toNumber()).toBe(5_000)
  })

  it("leaves a fully returned sale at zero with the history kept", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 2, 20_000)
    const sale = await sell(product.id, 2, { paid: 80_000 })

    await returnUnits(sale.id, 2)

    const after = await prisma.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: { items: true, returns: { include: { items: true } } },
    })
    expect(after.total.toNumber()).toBe(0)
    expect(after.items).toHaveLength(0)
    expect(after.returns[0].items[0].quantity).toBe(2)
    expect((await stockOf(product.id)).quantityOnHand).toBe(2)
    expect(await cash()).toBe(1_000_000 - 40_000)
  })

  it("refuses to return more than was sold", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 5, 20_000)
    const sale = await sell(product.id, 1, { paid: 40_000 })

    await expect(returnUnits(sale.id, 2)).rejects.toThrow(/Only 1/)
    expect((await stockOf(product.id)).quantityOnHand).toBe(4)
  })

  it("refuses a refund bigger than the cash on hand", async () => {
    await addCapital(20_000)
    const product = await addProduct()
    await buy(product.id, 1, 20_000)
    const sale = await sell(product.id, 1, { paid: 40_000 })
    await prisma.expense.create({
      data: { userId, category: "RENT", amount: 30_000 },
    })

    await expect(returnUnits(sale.id, 1)).rejects.toThrow(/needs that much cash/)
    expect((await stockOf(product.id)).quantityOnHand).toBe(0)
  })

  it("never touches another user's sale", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 1, 20_000)
    const sale = await sell(product.id, 1, { paid: 40_000 })
    const item = await prisma.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    })

    const other = await prisma.user.create({
      data: { email: `other-${randomUUID()}@test.local` },
    })
    await expect(
      recordSaleReturn(other.id, sale.id, {
        items: [{ saleItemId: item.id, quantity: 1 }],
        date: later,
        method: "CASH",
        note: null,
      })
    ).rejects.toThrow(/Sale not found/)
  })
})

describe("stock adjustments", () => {
  function adjust(productId: string, quantity: number, reason = "TESTER") {
    return adjustStock(userId, { productId, quantity, reason, note: null })
  }

  it("takes stock out at the average cost without moving it", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 5, 20_000)

    const movement = await adjust(product.id, -2)

    const after = await stockOf(product.id)
    expect(after.quantityOnHand).toBe(3)
    expect(after.avgCost.toNumber()).toBe(20_000)
    expect(movement.type).toBe("ADJUSTMENT")
    expect(movement.unitCost?.toNumber()).toBe(20_000)
    expect(await cash()).toBe(900_000)
  })

  it("counts stock written off against net profit, not cash", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 5, 20_000)
    await adjust(product.id, -2)
    await adjust(product.id, 1, "COUNT")

    const summary = await businessSummary(userId)
    expect(summary.stockWrittenOff.toNumber()).toBe(20_000)
    expect(summary.netProfit.toNumber()).toBe(-20_000)
    expect(summary.cash.toNumber()).toBe(900_000)
  })

  it("refuses to take out more than is in stock", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 1, 20_000)

    await expect(adjust(product.id, -2)).rejects.toThrow(/Only 1/)
    expect((await stockOf(product.id)).quantityOnHand).toBe(1)
  })

  it("undoes an adjustment and removes it", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 5, 20_000)
    const movement = await adjust(product.id, -2)

    await undoStockAdjustment(userId, movement.id)

    expect((await stockOf(product.id)).quantityOnHand).toBe(5)
    expect(
      await prisma.stockMovement.count({ where: { id: movement.id } })
    ).toBe(0)
  })

  it("won't undo stock added once it has been sold", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    const movement = await adjust(product.id, 1, "FOUND")
    await sell(product.id, 1)

    await expect(undoStockAdjustment(userId, movement.id)).rejects.toThrow(
      LedgerError
    )
    expect((await stockOf(product.id)).quantityOnHand).toBe(0)
  })

  it("never touches another user's stock", async () => {
    await addCapital(1_000_000)
    const product = await addProduct()
    await buy(product.id, 2, 20_000)
    const movement = await adjust(product.id, -1)

    const other = await prisma.user.create({
      data: { email: `other-${randomUUID()}@test.local` },
    })
    await expect(
      adjustStock(other.id, {
        productId: product.id,
        quantity: -1,
        reason: "LOST",
        note: null,
      })
    ).rejects.toThrow(/no longer exists/)
    await expect(undoStockAdjustment(other.id, movement.id)).rejects.toThrow(
      /no longer exists/
    )
    expect((await stockOf(product.id)).quantityOnHand).toBe(1)
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
