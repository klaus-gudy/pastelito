import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

// Read-only figures derived from the ledger. Nothing here is stored: stock,
// debts, profit and cash are always computed from the underlying records.

const { Decimal } = Prisma
const ZERO = new Decimal(0)

const sum = (values: Prisma.Decimal[]) =>
  values.reduce((total, value) => total.add(value), ZERO)

/** Units in stock and their value at average cost. */
export async function stockRemaining(userId: string) {
  const products = await prisma.product.findMany({
    where: { userId, active: true },
    orderBy: [{ name: "asc" }, { sizeMl: "asc" }],
  })
  return products.map((product) => ({
    productId: product.id,
    name: product.name,
    sizeMl: product.sizeMl,
    quantityOnHand: product.quantityOnHand,
    avgCost: product.avgCost,
    stockValue: product.avgCost.mul(product.quantityOnHand),
  }))
}

/** Unpaid balance on COMPLETED sales, grouped by customer. */
export async function customerDebts(userId: string) {
  const sales = await prisma.sale.findMany({
    where: { userId, status: "COMPLETED" },
    include: { payments: true, customer: true },
  })

  const byCustomer = new Map<
    string,
    { customerId: string | null; name: string; owed: Prisma.Decimal }
  >()
  for (const sale of sales) {
    const balance = sale.total.sub(sum(sale.payments.map((p) => p.amount)))
    if (balance.lte(0)) continue
    const key = sale.customerId ?? "walk-in"
    const entry = byCustomer.get(key) ?? {
      customerId: sale.customerId,
      name: sale.customer?.name ?? "Walk-in",
      owed: ZERO,
    }
    entry.owed = entry.owed.add(balance)
    byCustomer.set(key, entry)
  }
  return [...byCustomer.values()].sort((a, b) => b.owed.cmp(a.owed))
}

/** Units and revenue per product (each size is its own product). */
export async function bestSellers(userId: string) {
  const items = await prisma.saleItem.findMany({
    where: { sale: { userId, status: "COMPLETED" } },
    include: { product: true },
  })

  const byProduct = new Map<
    string,
    { productId: string; name: string; sizeMl: number; units: number; revenue: Prisma.Decimal }
  >()
  for (const item of items) {
    const entry = byProduct.get(item.productId) ?? {
      productId: item.productId,
      name: item.product.name,
      sizeMl: item.product.sizeMl,
      units: 0,
      revenue: ZERO,
    }
    entry.units += item.quantity
    entry.revenue = entry.revenue.add(item.lineTotal)
    byProduct.set(item.productId, entry)
  }
  return [...byProduct.values()].sort((a, b) => b.units - a.units)
}

/**
 * Headline numbers. Capital repayments reduce cash and capital owed but are
 * never part of profit.
 */
export async function businessSummary(userId: string) {
  const [completedSales, completedItems, livePayments, capital, received, expenses] =
    await Promise.all([
      prisma.sale.findMany({
        where: { userId, status: "COMPLETED" },
        select: { total: true, payments: { select: { amount: true } } },
      }),
      prisma.saleItem.findMany({
        where: { sale: { userId, status: "COMPLETED" } },
        select: { quantity: true, unitCost: true },
      }),
      // Payments on cancelled sales are assumed refunded, so they are excluded.
      prisma.payment.aggregate({
        where: { sale: { userId, status: { in: ["PREORDER", "COMPLETED"] } } },
        _sum: { amount: true },
      }),
      prisma.capitalEntry.groupBy({
        by: ["type"],
        where: { userId },
        _sum: { amount: true },
      }),
      prisma.purchase.aggregate({
        where: { userId, status: "RECEIVED" },
        _sum: { total: true },
      }),
      prisma.expense.aggregate({ where: { userId }, _sum: { amount: true } }),
    ])

  const capitalReceived =
    capital.find((row) => row.type === "RECEIVED")?._sum.amount ?? ZERO
  const capitalRepaid =
    capital.find((row) => row.type === "REPAID")?._sum.amount ?? ZERO
  const paymentsReceived = livePayments._sum.amount ?? ZERO
  const purchasesPaid = received._sum.total ?? ZERO
  const expensesTotal = expenses._sum.amount ?? ZERO

  const revenue = sum(completedSales.map((sale) => sale.total))
  const costOfGoodsSold = sum(
    completedItems.map((item) => item.unitCost.mul(item.quantity))
  )
  const collected = sum(
    completedSales.flatMap((sale) => sale.payments.map((p) => p.amount))
  )

  return {
    revenue,
    costOfGoodsSold,
    grossProfit: revenue.sub(costOfGoodsSold),
    expenses: expensesTotal,
    netProfit: revenue.sub(costOfGoodsSold).sub(expensesTotal),
    customerDebt: revenue.sub(collected),
    capitalReceived,
    capitalRepaid,
    capitalOwed: capitalReceived.sub(capitalRepaid),
    paymentsReceived,
    cash: capitalReceived
      .add(paymentsReceived)
      .sub(capitalRepaid)
      .sub(purchasesPaid)
      .sub(expensesTotal),
  }
}

/**
 * Sales, gross profit and money collected for sales dated in [from, to).
 * Payments count by the day they were made, including preorder deposits.
 */
export async function periodFigures(
  userId: string,
  { from, to }: { from: Date; to: Date }
) {
  const [sales, items, collected] = await Promise.all([
    prisma.sale.aggregate({
      where: { userId, status: "COMPLETED", date: { gte: from, lt: to } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.saleItem.findMany({
      where: {
        sale: { userId, status: "COMPLETED", date: { gte: from, lt: to } },
      },
      select: { quantity: true, unitCost: true },
    }),
    // Payments on cancelled sales are assumed refunded, so they are excluded.
    prisma.payment.aggregate({
      where: {
        paidAt: { gte: from, lt: to },
        sale: { userId, status: { in: ["PREORDER", "COMPLETED"] } },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  const revenue = sales._sum.total ?? ZERO
  const costOfGoodsSold = sum(
    items.map((item) => item.unitCost.mul(item.quantity))
  )
  return {
    sales: sales._count,
    revenue,
    grossProfit: revenue.sub(costOfGoodsSold),
    collected: collected._sum.amount ?? ZERO,
    payments: collected._count,
  }
}
