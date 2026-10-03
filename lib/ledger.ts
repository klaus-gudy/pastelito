import { Prisma } from "@/lib/generated/prisma/client"
import type { PaymentMethod } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

// Transactional helpers that keep stock, average cost and statuses consistent.
// Every function takes the owning userId and only touches that user's rows.

const { Decimal } = Prisma

export class LedgerError extends Error {}

const purchaseTransitions = {
  DRAFT: ["RECEIVED", "CANCELLED"],
  RECEIVED: [],
  CANCELLED: [],
} as const

const saleTransitions = {
  DRAFT: ["PREORDER", "COMPLETED", "CANCELLED"],
  PREORDER: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
} as const

function assertTransition<S extends string>(
  allowed: Record<S, readonly string[]>,
  from: S,
  to: string
) {
  if (!allowed[from].includes(to)) {
    throw new LedgerError(`Cannot change status from ${from} to ${to}.`)
  }
}

/** New average cost after adding stock: (oldQty*oldAvg + newQty*newCost) / (oldQty + newQty). */
export function weightedAverageCost(
  oldQty: number,
  oldAvg: Prisma.Decimal,
  newQty: number,
  newCost: Prisma.Decimal
) {
  const totalQty = oldQty + newQty
  if (totalQty <= 0) return new Decimal(0)
  return oldAvg
    .mul(oldQty)
    .add(newCost.mul(newQty))
    .div(totalQty)
    .toDecimalPlaces(4)
}

/** DRAFT -> RECEIVED: adds stock, recalculates each product's average cost. */
export async function receivePurchase(userId: string, purchaseId: string) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findFirst({
      where: { id: purchaseId, userId },
      include: { items: true },
    })
    if (!purchase) throw new LedgerError("Purchase not found.")
    assertTransition(purchaseTransitions, purchase.status, "RECEIVED")
    if (purchase.items.length === 0) {
      throw new LedgerError("A purchase needs at least one item.")
    }

    for (const item of purchase.items) {
      const product = await tx.product.findFirstOrThrow({
        where: { id: item.productId, userId },
      })
      await tx.product.update({
        where: { id: product.id },
        data: {
          quantityOnHand: product.quantityOnHand + item.quantity,
          avgCost: weightedAverageCost(
            product.quantityOnHand,
            product.avgCost,
            item.quantity,
            item.unitCost
          ),
        },
      })
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: "PURCHASE",
          quantity: item.quantity,
          refId: purchase.id,
        },
      })
    }

    return tx.purchase.update({
      where: { id: purchase.id },
      data: { status: "RECEIVED", receivedAt: new Date() },
    })
  })
}

export async function cancelPurchase(userId: string, purchaseId: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, userId },
  })
  if (!purchase) throw new LedgerError("Purchase not found.")
  assertTransition(purchaseTransitions, purchase.status, "CANCELLED")
  return prisma.purchase.update({
    where: { id: purchase.id },
    data: { status: "CANCELLED" },
  })
}

/** DRAFT -> PREORDER: taken before stock is available. Needs a customer. */
export async function markPreorder(userId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({ where: { id: saleId, userId } })
  if (!sale) throw new LedgerError("Sale not found.")
  assertTransition(saleTransitions, sale.status, "PREORDER")
  if (!sale.customerId) {
    throw new LedgerError("A preorder needs a customer.")
  }
  return prisma.sale.update({
    where: { id: sale.id },
    data: { status: "PREORDER" },
  })
}

/**
 * -> COMPLETED: deducts stock, snapshots each item's cost at the product's
 * current average cost and rejects overselling.
 */
export async function completeSale(userId: string, saleId: string) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, userId },
      include: { items: true },
    })
    if (!sale) throw new LedgerError("Sale not found.")
    assertTransition(saleTransitions, sale.status, "COMPLETED")
    if (sale.items.length === 0) {
      throw new LedgerError("A sale needs at least one item.")
    }

    for (const item of sale.items) {
      const product = await tx.product.findFirstOrThrow({
        where: { id: item.productId, userId },
      })
      if (product.quantityOnHand < item.quantity) {
        throw new LedgerError(
          `Not enough stock for ${product.name} ${product.sizeMl}ml: ` +
            `${product.quantityOnHand} left, ${item.quantity} requested.`
        )
      }
      await tx.product.update({
        where: { id: product.id },
        data: { quantityOnHand: product.quantityOnHand - item.quantity },
      })
      await tx.saleItem.update({
        where: { id: item.id },
        data: { unitCost: product.avgCost },
      })
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: "SALE",
          quantity: -item.quantity,
          refId: sale.id,
        },
      })
    }

    return tx.sale.update({
      where: { id: sale.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    })
  })
}

export async function cancelSale(userId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({ where: { id: saleId, userId } })
  if (!sale) throw new LedgerError("Sale not found.")
  assertTransition(saleTransitions, sale.status, "CANCELLED")
  return prisma.sale.update({
    where: { id: sale.id },
    data: { status: "CANCELLED" },
  })
}

/** Records an installment or preorder deposit. Never lets a sale be overpaid. */
export async function recordPayment(
  userId: string,
  saleId: string,
  input: {
    amount: Prisma.Decimal | string | number
    method: PaymentMethod
    paidAt?: Date
    note?: string
  }
) {
  const amount = new Decimal(input.amount)
  if (amount.lte(0)) throw new LedgerError("Payment must be more than zero.")

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, userId },
      include: { payments: true },
    })
    if (!sale) throw new LedgerError("Sale not found.")
    if (sale.status === "DRAFT" || sale.status === "CANCELLED") {
      throw new LedgerError(`Can't take a payment on a ${sale.status} sale.`)
    }

    const paid = sale.payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Decimal(0)
    )
    if (paid.add(amount).gt(sale.total)) {
      throw new LedgerError(
        `Payment is more than the balance of ${sale.total.sub(paid)}.`
      )
    }

    return tx.payment.create({
      data: {
        saleId: sale.id,
        amount,
        method: input.method,
        paidAt: input.paidAt,
        note: input.note,
      },
    })
  })
}
