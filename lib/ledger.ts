import { Prisma } from "@/lib/generated/prisma/client"
import type { PaymentMethod } from "@/lib/generated/prisma/client"
import { formatMoney } from "@/lib/format"
import { prisma } from "@/lib/prisma"

// Transactional helpers that keep stock, average cost and statuses consistent.
// Every function takes the owning userId and only touches that user's rows.

const { Decimal } = Prisma

type Tx = Prisma.TransactionClient

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

/** Adds purchased items to stock and recalculates each product's average cost. */
async function addPurchaseStock(
  tx: Tx,
  userId: string,
  purchaseId: string,
  items: { productId: string; quantity: number; unitCost: Prisma.Decimal }[]
) {
  for (const item of items) {
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
        refId: purchaseId,
      },
    })
  }
}

/**
 * Records a purchase that has already arrived: finds or creates the supplier,
 * creates the purchase as RECEIVED and adds its stock, all in one transaction.
 */
export async function recordReceivedPurchase(
  userId: string,
  input: {
    supplierName: string | null
    date: Date
    method: PaymentMethod
    note: string | null
    items: {
      productId: string
      quantity: number
      unitCost: Prisma.Decimal | string | number
    }[]
  }
) {
  if (input.items.length === 0) {
    throw new LedgerError("A purchase needs at least one item.")
  }

  return prisma.$transaction(async (tx) => {
    let supplierId: string | null = null
    if (input.supplierName) {
      const existing = await tx.supplier.findFirst({
        where: {
          userId,
          name: { equals: input.supplierName, mode: "insensitive" },
        },
        select: { id: true },
      })
      supplierId =
        existing?.id ??
        (
          await tx.supplier.create({
            data: { userId, name: input.supplierName },
            select: { id: true },
          })
        ).id
    }

    const lines = input.items.map((item) => {
      const unitCost = new Decimal(item.unitCost)
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitCost,
        lineTotal: unitCost.mul(item.quantity).toDecimalPlaces(2),
      }
    })
    const total = lines.reduce(
      (sum, line) => sum.add(line.lineTotal),
      new Decimal(0)
    )

    const purchase = await tx.purchase.create({
      data: {
        userId,
        supplierId,
        status: "RECEIVED",
        receivedAt: new Date(),
        date: input.date,
        method: input.method,
        note: input.note,
        total,
        items: { create: lines },
      },
    })
    await addPurchaseStock(tx, userId, purchase.id, lines)
    return purchase
  })
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

    await addPurchaseStock(tx, userId, purchase.id, purchase.items)

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
 * Takes one sale line out of stock, rejecting overselling, and returns the
 * product's average cost to snapshot on the item.
 */
async function takeSaleStock(
  tx: Tx,
  userId: string,
  saleId: string,
  item: { productId: string; quantity: number }
) {
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
  await tx.stockMovement.create({
    data: {
      productId: product.id,
      type: "SALE",
      quantity: -item.quantity,
      refId: saleId,
    },
  })
  return product.avgCost
}

/**
 * Records a sale that has already happened: creates it as COMPLETED, takes its
 * stock and logs the payment made now (if any), all in one transaction. Any
 * unpaid balance stays as the customer's debt.
 */
export async function recordCompletedSale(
  userId: string,
  input: {
    customerId: string | null
    date: Date
    discount: Prisma.Decimal | string | number
    note: string | null
    items: {
      productId: string
      brand: string | null
      quantity: number
      unitPrice: Prisma.Decimal | string | number
    }[]
    payment: {
      amount: Prisma.Decimal | string | number
      method: PaymentMethod
    } | null
  }
) {
  if (input.items.length === 0) {
    throw new LedgerError("A sale needs at least one item.")
  }

  const lines = input.items.map((item) => {
    const unitPrice = new Decimal(item.unitPrice)
    return {
      productId: item.productId,
      brand: item.brand,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice.mul(item.quantity).toDecimalPlaces(2),
    }
  })
  const subtotal = lines.reduce(
    (sum, line) => sum.add(line.lineTotal),
    new Decimal(0)
  )
  const discount = new Decimal(input.discount)
  const total = subtotal.sub(discount)
  if (discount.lt(0) || total.lte(0)) {
    throw new LedgerError("The discount must be less than the sale total.")
  }
  const paid = input.payment ? new Decimal(input.payment.amount) : null
  if (paid && paid.gt(total)) {
    throw new LedgerError(`Payment is more than the sale total of ${total}.`)
  }

  return prisma.$transaction(async (tx) => {
    if (input.customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: input.customerId, userId, deletedAt: null },
        select: { id: true },
      })
      if (!customer) throw new LedgerError("Customer not found.")
    }

    const sale = await tx.sale.create({
      data: {
        userId,
        customerId: input.customerId,
        status: "COMPLETED",
        date: input.date,
        completedAt: new Date(),
        total,
        discount,
        note: input.note,
      },
    })
    for (const line of lines) {
      const unitCost = await takeSaleStock(tx, userId, sale.id, line)
      await tx.saleItem.create({ data: { ...line, saleId: sale.id, unitCost } })
    }
    if (input.payment && paid && paid.gt(0)) {
      await tx.payment.create({
        data: {
          saleId: sale.id,
          amount: paid,
          method: input.payment.method,
          paidAt: input.date,
        },
      })
    }
    return sale
  })
}

/**
 * Records a preorder taken before stock is available: creates it as PREORDER
 * with its items and the deposit paid now (if any). Stock is only taken when
 * it is delivered with completeSale.
 */
export async function recordPreorder(
  userId: string,
  input: {
    customerId: string
    date: Date
    discount: Prisma.Decimal | string | number
    note: string | null
    items: {
      productId: string
      brand: string | null
      quantity: number
      unitPrice: Prisma.Decimal | string | number
    }[]
    deposit: {
      amount: Prisma.Decimal | string | number
      method: PaymentMethod
    } | null
  }
) {
  if (input.items.length === 0) {
    throw new LedgerError("A preorder needs at least one item.")
  }

  const lines = input.items.map((item) => {
    const unitPrice = new Decimal(item.unitPrice)
    return {
      productId: item.productId,
      brand: item.brand,
      quantity: item.quantity,
      unitPrice,
      // Snapshotted from the product's average cost on delivery.
      unitCost: new Decimal(0),
      lineTotal: unitPrice.mul(item.quantity).toDecimalPlaces(2),
    }
  })
  const subtotal = lines.reduce(
    (sum, line) => sum.add(line.lineTotal),
    new Decimal(0)
  )
  const discount = new Decimal(input.discount)
  const total = subtotal.sub(discount)
  if (discount.lt(0) || total.lte(0)) {
    throw new LedgerError("The discount must be less than the preorder total.")
  }
  const deposit = input.deposit ? new Decimal(input.deposit.amount) : null
  if (deposit && deposit.gt(total)) {
    throw new LedgerError(
      `The deposit is more than the preorder total of ${formatMoney(total)}.`
    )
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, userId, deletedAt: null },
      select: { id: true },
    })
    if (!customer) throw new LedgerError("Customer not found.")

    const sale = await tx.sale.create({
      data: {
        userId,
        customerId: customer.id,
        status: "PREORDER",
        date: input.date,
        orderedAt: input.date,
        total,
        discount,
        note: input.note,
        items: { create: lines },
      },
    })
    if (input.deposit && deposit && deposit.gt(0)) {
      await tx.payment.create({
        data: {
          saleId: sale.id,
          amount: deposit,
          method: input.deposit.method,
          paidAt: input.date,
        },
      })
    }
    return sale
  })
}

/**
 * -> COMPLETED: deducts stock, snapshots each item's cost at the product's
 * current average cost and rejects overselling. A delivered preorder can be
 * dated on its delivery day and take a payment at the same time.
 */
export async function completeSale(
  userId: string,
  saleId: string,
  options: {
    date?: Date
    payment?: {
      amount: Prisma.Decimal | string | number
      method: PaymentMethod
    } | null
  } = {}
) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, userId },
      include: { items: true, payments: true },
    })
    if (!sale) throw new LedgerError("Sale not found.")
    assertTransition(saleTransitions, sale.status, "COMPLETED")
    if (sale.items.length === 0) {
      throw new LedgerError("A sale needs at least one item.")
    }

    for (const item of sale.items) {
      const unitCost = await takeSaleStock(tx, userId, sale.id, item)
      await tx.saleItem.update({ where: { id: item.id }, data: { unitCost } })
    }

    const date = options.date ?? sale.date
    if (date < (sale.orderedAt ?? sale.date)) {
      throw new LedgerError("Delivery can't be before the order date.")
    }
    const amount = options.payment ? new Decimal(options.payment.amount) : null
    if (options.payment && amount && amount.gt(0)) {
      const paid = sale.payments.reduce(
        (sum, payment) => sum.add(payment.amount),
        new Decimal(0)
      )
      if (paid.add(amount).gt(sale.total)) {
        throw new LedgerError(
          `Payment is more than the balance of ${formatMoney(sale.total.sub(paid))}.`
        )
      }
      await tx.payment.create({
        data: {
          saleId: sale.id,
          amount,
          method: options.payment.method,
          paidAt: date,
        },
      })
    }

    return tx.sale.update({
      where: { id: sale.id },
      data: { status: "COMPLETED", completedAt: new Date(), date },
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
        `Payment is more than the balance of ${formatMoney(sale.total.sub(paid))}.`
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
