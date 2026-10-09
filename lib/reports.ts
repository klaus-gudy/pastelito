import { Prisma } from "@/lib/generated/prisma/client"
import type { HealthInputs } from "@/lib/health"
import { prisma } from "@/lib/prisma"

// Read-only figures derived from the ledger. Nothing here is stored: stock,
// debts, profit and cash are always computed from the underlying records.

const { Decimal } = Prisma
const ZERO = new Decimal(0)

type Db = Prisma.TransactionClient | typeof prisma

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
 * never part of profit. Pass a transaction to check cash before spending it.
 */
export async function businessSummary(userId: string, db: Db = prisma) {
  const [completedSales, completedItems, livePayments, capital, received, expenses] =
    await Promise.all([
      db.sale.findMany({
        where: { userId, status: "COMPLETED" },
        select: { total: true, payments: { select: { amount: true } } },
      }),
      db.saleItem.findMany({
        where: { sale: { userId, status: "COMPLETED" } },
        select: { quantity: true, unitCost: true },
      }),
      // Payments on cancelled sales are assumed refunded, so they are excluded.
      db.payment.aggregate({
        where: { sale: { userId, status: { in: ["PREORDER", "COMPLETED"] } } },
        _sum: { amount: true },
      }),
      db.capitalEntry.groupBy({
        by: ["type"],
        where: { userId },
        _sum: { amount: true },
      }),
      db.purchase.aggregate({
        where: { userId, status: "RECEIVED" },
        _sum: { total: true },
      }),
      db.expense.aggregate({ where: { userId }, _sum: { amount: true } }),
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

  // Where today's cash came from. Purchases and expenses are paid from
  // capital first, and only from customer payments once it runs out;
  // repayments come off the capital. The two parts add up to cash.
  const capitalKept = capitalReceived.sub(capitalRepaid)
  const spent = purchasesPaid.add(expensesTotal)
  const capitalUsed = Decimal.min(spent, Decimal.max(capitalKept, ZERO))
  const paymentsUsed = spent.sub(capitalUsed)

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
    spent,
    capitalUsed,
    cashFromCapital: capitalKept.sub(capitalUsed),
    cashFromPayments: paymentsReceived.sub(paymentsUsed),
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
    unitsSold: items.reduce((units, item) => units + item.quantity, 0),
  }
}

const DAY = 24 * 60 * 60 * 1000

/**
 * The figures business health is judged on, for the period `range` (with the
 * one before it, if any) and as things stand today. Debt from sales older
 * than `overdueDays` counts as overdue.
 */
export async function healthInputs(
  userId: string,
  range: {
    current: { from: Date; to: Date }
    previous: { from: Date; to: Date } | null
  },
  overdueDays: number,
  now = new Date()
): Promise<HealthInputs> {
  const inPeriod = { gte: range.current.from, lt: range.current.to }
  const [
    summary,
    current,
    previous,
    stock,
    completed,
    buyers,
    oldestPreorder,
    preordersWaiting,
    firstSale,
  ] = await Promise.all([
    businessSummary(userId),
    periodFigures(userId, range.current),
    range.previous ? periodFigures(userId, range.previous) : null,
    stockRemaining(userId),
    prisma.sale.findMany({
      where: { userId, status: "COMPLETED" },
      select: { date: true, total: true, payments: { select: { amount: true } } },
    }),
    prisma.sale.groupBy({
      by: ["customerId"],
      where: {
        userId,
        status: "COMPLETED",
        customerId: { not: null },
        date: inPeriod,
      },
    }),
    // A preorder's sale date is the day it was taken until it's delivered.
    prisma.sale.findFirst({
      where: { userId, status: "PREORDER" },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.sale.count({ where: { userId, status: "PREORDER" } }),
    prisma.sale.findFirst({
      where: { userId, status: "COMPLETED" },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
  ])

  const buyerIds = buyers.flatMap((row) => (row.customerId ? [row.customerId] : []))
  const repeatBuyers = buyerIds.length
    ? await prisma.sale.groupBy({
        by: ["customerId"],
        where: { userId, status: "COMPLETED", customerId: { in: buyerIds } },
        _count: true,
        having: { customerId: { _count: { gte: 2 } } },
      })
    : []

  const overdueBefore = new Date(now.getTime() - overdueDays * DAY)
  const overdueDebt = sum(
    completed
      .filter((sale) => sale.date < overdueBefore)
      .map((sale) => sale.total.sub(sum(sale.payments.map((p) => p.amount))))
      .filter((balance) => balance.gt(0))
  )
  // All time starts at the first sale, not at the epoch.
  const from = firstSale
    ? new Date(Math.max(range.current.from.getTime(), firstSale.date.getTime()))
    : range.current.from
  const periodDays = Math.max(
    (Math.min(range.current.to.getTime(), now.getTime()) - from.getTime()) / DAY,
    1
  )

  return {
    revenue: current.revenue.toNumber(),
    grossProfit: current.grossProfit.toNumber(),
    collected: current.collected.toNumber(),
    unitsSold: current.unitsSold,
    periodDays,
    previousRevenue: previous ? previous.revenue.toNumber() : null,
    unitsOnHand: stock.reduce((units, product) => units + product.quantityOnHand, 0),
    preordersWaiting,
    oldestPreorderDays: oldestPreorder
      ? Math.max(Math.floor((now.getTime() - oldestPreorder.date.getTime()) / DAY), 0)
      : null,
    allTimeGrossProfit: summary.grossProfit.toNumber(),
    capitalReceived: summary.capitalReceived.toNumber(),
    debt: summary.customerDebt.toNumber(),
    overdueDebt: overdueDebt.toNumber(),
    buyers: buyerIds.length,
    repeatBuyers: repeatBuyers.length,
  }
}
