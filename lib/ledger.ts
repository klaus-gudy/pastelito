import { Prisma } from "@/lib/generated/prisma/client"
import type { PaymentMethod } from "@/lib/generated/prisma/client"
import { formatMoney } from "@/lib/format"
import { postCash, replaceCash, reverseCash } from "@/lib/journal"
import { prisma } from "@/lib/prisma"
import { businessSummary } from "@/lib/reports"
import { returnTotals } from "@/lib/returns"

// Transactional helpers that keep stock, average cost and statuses consistent.
// Every function takes the owning userId and only touches that user's rows.

const { Decimal } = Prisma

type Tx = Prisma.TransactionClient

export class LedgerError extends Error {}

// Money columns are Decimal(14, 2).
const MAX_MONEY = new Decimal("999999999999.99")

function assertStorable(total: Prisma.Decimal) {
  if (total.gt(MAX_MONEY)) {
    throw new LedgerError("That total is too large to record. Split it up.")
  }
}

const MAX_ATTEMPTS = 3

/** Postgres aborted the transaction because a concurrent one conflicted. */
function isWriteConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034"
  }
  // A conflict found at COMMIT arrives from the driver adapter unwrapped.
  const cause = (error as { cause?: { kind?: unknown } } | null)?.cause
  return cause?.kind === "TransactionWriteConflict"
}

/**
 * Runs a transaction at Serializable isolation, so two requests can't both
 * read the same stock or balance and each write past it (overselling,
 * overpaying, losing a stock update). Postgres aborts one of a conflicting
 * pair; it is retried a few times before giving up.
 */
export async function serializable<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(run, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      if (!isWriteConflict(error)) throw error
      if (attempt >= MAX_ATTEMPTS) {
        throw new LedgerError("Someone else changed this just now. Try again.")
      }
    }
  }
}

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

/** Who a sale's money came from or went to, for the cash journal. */
async function customerLabel(tx: Tx, customerId: string | null) {
  const customer = customerId
    ? await tx.customer.findUnique({
        where: { id: customerId },
        select: { name: true },
      })
    : null
  return customer?.name ?? "walk-in customer"
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

/**
 * Average cost after taking back units that came in at `removedCost`, the
 * reverse of weightedAverageCost. With nothing left, the average stays as it
 * was; it never goes below zero.
 */
export function averageCostWithout(
  qty: number,
  avg: Prisma.Decimal,
  removedQty: number,
  removedCost: Prisma.Decimal
) {
  const remaining = qty - removedQty
  if (remaining <= 0) return avg
  return Decimal.max(
    avg.mul(qty).sub(removedCost.mul(removedQty)).div(remaining),
    0
  ).toDecimalPlaces(4)
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

  return serializable(async (tx) => {
    let supplierId: string | null = null
    let supplierName: string | null = null
    if (input.supplierName) {
      // A live supplier first; else a deleted one by that name comes back.
      const existing = await tx.supplier.findFirst({
        where: {
          userId,
          name: { equals: input.supplierName, mode: "insensitive" },
        },
        orderBy: { deletedAt: { sort: "asc", nulls: "first" } },
        select: { id: true, name: true, deletedAt: true },
      })
      if (existing?.deletedAt) {
        await tx.supplier.update({
          where: { id: existing.id },
          data: { deletedAt: null },
        })
      }
      supplierId =
        existing?.id ??
        (
          await tx.supplier.create({
            data: { userId, name: input.supplierName },
            select: { id: true },
          })
        ).id
      supplierName = existing?.name ?? input.supplierName
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
    assertStorable(total)

    // Purchases are paid from cash, so cash can never go below zero. Checked
    // in this transaction so two purchases can't both spend the same cash.
    const { cash } = await businessSummary(userId, tx)
    if (total.gt(cash)) {
      throw new LedgerError(
        cash.gt(0)
          ? `Not enough cash: this purchase costs ${formatMoney(total)} but you have ${formatMoney(cash)}. Add capital first.`
          : "You have no cash to buy with. Add capital first."
      )
    }

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
    await postCash(tx, userId, {
      kind: "PURCHASE",
      amount: total,
      occurredAt: input.date,
      method: input.method,
      refType: "PURCHASE",
      refId: purchase.id,
      description: supplierName ? `Purchase from ${supplierName}` : "Purchase",
    })
    return purchase
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
  assertStorable(subtotal)
  const discount = new Decimal(input.discount)
  const total = subtotal.sub(discount)
  if (discount.lt(0) || total.lte(0)) {
    throw new LedgerError("The discount must be less than the sale total.")
  }
  const paid = input.payment ? new Decimal(input.payment.amount) : null
  if (paid && paid.gt(total)) {
    throw new LedgerError(`Payment is more than the sale total of ${total}.`)
  }

  return serializable(async (tx) => {
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
      const payment = await tx.payment.create({
        data: {
          saleId: sale.id,
          amount: paid,
          method: input.payment.method,
          paidAt: input.date,
        },
      })
      await postCash(tx, userId, {
        kind: "SALE_PAYMENT",
        amount: paid,
        occurredAt: input.date,
        method: payment.method,
        refType: "SALE",
        refId: sale.id,
        lineId: payment.id,
        description: `Payment from ${await customerLabel(tx, input.customerId)}`,
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
  assertStorable(subtotal)
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

  return serializable(async (tx) => {
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
      const payment = await tx.payment.create({
        data: {
          saleId: sale.id,
          amount: deposit,
          method: input.deposit.method,
          paidAt: input.date,
        },
      })
      await postCash(tx, userId, {
        kind: "SALE_PAYMENT",
        amount: deposit,
        occurredAt: input.date,
        method: payment.method,
        refType: "SALE",
        refId: sale.id,
        lineId: payment.id,
        description: `Preorder deposit from ${await customerLabel(tx, customer.id)}`,
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
  return serializable(async (tx) => {
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
      const payment = await tx.payment.create({
        data: {
          saleId: sale.id,
          amount,
          method: options.payment.method,
          paidAt: date,
        },
      })
      await postCash(tx, userId, {
        kind: "SALE_PAYMENT",
        amount,
        occurredAt: date,
        method: payment.method,
        refType: "SALE",
        refId: sale.id,
        lineId: payment.id,
        description: `Payment from ${await customerLabel(tx, sale.customerId)} on delivery`,
      })
    }

    return tx.sale.update({
      where: { id: sale.id },
      data: { status: "COMPLETED", completedAt: new Date(), date },
    })
  })
}

export async function cancelSale(userId: string, saleId: string) {
  // In a transaction, so a preorder delivered at the same moment can't end
  // up cancelled with its stock already taken.
  return serializable(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, userId },
      include: { payments: { select: { amount: true } } },
    })
    if (!sale) throw new LedgerError("Sale not found.")
    assertTransition(saleTransitions, sale.status, "CANCELLED")

    // Cancelling refunds whatever was paid, out of cash, and cash can never
    // go below zero. The deposit may already have been spent on stock.
    const refund = sale.payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Decimal(0)
    )
    if (refund.gt(0)) {
      const { cash } = await businessSummary(userId, tx)
      if (refund.gt(cash)) {
        throw new LedgerError(
          `Refunding the ${formatMoney(refund)} paid needs that much cash, but you have ${formatMoney(cash)}. Add capital first.`
        )
      }
      await postCash(tx, userId, {
        kind: "REFUND",
        amount: refund,
        occurredAt: new Date(),
        method: null,
        refType: "SALE",
        refId: sale.id,
        description: `Refund to ${await customerLabel(tx, sale.customerId)}, sale cancelled`,
      })
    }
    return tx.sale.update({
      where: { id: sale.id },
      data: { status: "CANCELLED" },
    })
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

  return serializable(async (tx) => {
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

    const payment = await tx.payment.create({
      data: {
        saleId: sale.id,
        amount,
        method: input.method,
        paidAt: input.paidAt,
        note: input.note,
      },
    })
    await postCash(tx, userId, {
      kind: "SALE_PAYMENT",
      amount,
      occurredAt: payment.paidAt,
      method: payment.method,
      refType: "SALE",
      refId: sale.id,
      lineId: payment.id,
      description: `Payment from ${await customerLabel(tx, sale.customerId)}`,
    })
    return payment
  })
}

/**
 * Changes stock by hand: testers, breakage, losses, count corrections. A
 * positive quantity adds stock, a negative one removes it, never below zero.
 * The average cost stays as it is and is snapshotted on the movement, so
 * stock written off can be valued later.
 */
export async function adjustStock(
  userId: string,
  input: {
    productId: string
    quantity: number
    reason: string
    note: string | null
  }
) {
  if (!Number.isInteger(input.quantity) || input.quantity === 0) {
    throw new LedgerError("Adjust by a whole number of units.")
  }

  return serializable(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, userId, active: true, deletedAt: null },
    })
    if (!product) throw new LedgerError("That product no longer exists.")

    const quantityOnHand = product.quantityOnHand + input.quantity
    if (quantityOnHand < 0) {
      throw new LedgerError(
        `Only ${product.quantityOnHand} of ${product.name} ${product.sizeMl}ml in stock.`
      )
    }

    await tx.product.update({
      where: { id: product.id },
      data: { quantityOnHand },
    })
    return tx.stockMovement.create({
      data: {
        productId: product.id,
        type: "ADJUSTMENT",
        quantity: input.quantity,
        reason: input.reason,
        note: input.note,
        unitCost: product.avgCost,
      },
    })
  })
}

/**
 * Reverses an adjustment made by mistake and removes it. Undoing one that
 * added stock is refused once that stock has been sold.
 */
export async function undoStockAdjustment(userId: string, movementId: string) {
  return serializable(async (tx) => {
    const movement = await tx.stockMovement.findFirst({
      where: { id: movementId, type: "ADJUSTMENT", product: { userId } },
      include: { product: true },
    })
    if (!movement) throw new LedgerError("That adjustment no longer exists.")

    const { product } = movement
    const quantityOnHand = product.quantityOnHand - movement.quantity
    if (quantityOnHand < 0) {
      throw new LedgerError(
        `Only ${product.quantityOnHand} of ${product.name} ${product.sizeMl}ml left in stock, so the ${movement.quantity} added can't be taken back.`
      )
    }

    await tx.product.update({
      where: { id: product.id },
      data: { quantityOnHand },
    })
    await tx.stockMovement.delete({ where: { id: movement.id } })
    return movement
  })
}

/**
 * Takes items back from a completed sale. The sale is reduced (its items,
 * total and discount), the units go back into stock at the cost they left
 * at, and whatever the customer paid beyond the new total is refunded as a
 * negative payment, out of cash. Returning every unit leaves the sale at
 * zero with nothing on it; the return keeps the history.
 */
export async function recordSaleReturn(
  userId: string,
  saleId: string,
  input: {
    items: { saleItemId: string; quantity: number }[]
    date: Date
    method: PaymentMethod
    note: string | null
  }
) {
  const lines = input.items.filter((item) => item.quantity > 0)
  if (lines.length === 0) {
    throw new LedgerError("Pick at least one item to return.")
  }

  return serializable(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, userId },
      include: { items: true, payments: { select: { amount: true } } },
    })
    if (!sale) throw new LedgerError("Sale not found.")
    if (sale.status !== "COMPLETED") {
      throw new LedgerError("Only completed sales can have items returned.")
    }
    if (input.date < sale.date) {
      throw new LedgerError("A return can't be dated before the sale.")
    }

    const returned = lines.map((line) => {
      const item = sale.items.find((candidate) => candidate.id === line.saleItemId)
      if (!item) throw new LedgerError("That item is no longer on the sale.")
      if (!Number.isInteger(line.quantity) || line.quantity > item.quantity) {
        throw new LedgerError(
          `Only ${item.quantity} of that item can be returned.`
        )
      }
      return { item, quantity: line.quantity }
    })

    const subtotal = sale.items.reduce(
      (sum, item) => sum.add(item.lineTotal),
      new Decimal(0)
    )
    const returnedValue = returned.reduce(
      (sum, { item, quantity }) => sum.add(item.unitPrice.mul(quantity)),
      new Decimal(0)
    )
    const unitsLeft =
      sale.items.reduce((units, item) => units + item.quantity, 0) -
      returned.reduce((units, { quantity }) => units + quantity, 0)
    const paid = sale.payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Decimal(0)
    )
    const totals = returnTotals({
      total: sale.total.toNumber(),
      subtotal: subtotal.toNumber(),
      paid: paid.toNumber(),
      returnedValue: returnedValue.toNumber(),
      returnsEverything: unitsLeft === 0,
    })

    // Refunds come out of cash, and cash can never go below zero.
    const refund = new Decimal(totals.refund)
    if (refund.gt(0)) {
      const { cash } = await businessSummary(userId, tx)
      if (refund.gt(cash)) {
        throw new LedgerError(
          `Refunding ${formatMoney(refund)} needs that much cash, but you have ${formatMoney(cash)}. Add capital first.`
        )
      }
    }

    const saleReturn = await tx.saleReturn.create({
      data: {
        userId,
        saleId: sale.id,
        date: input.date,
        credit: totals.credit,
        refund,
        method: input.method,
        note: input.note,
        items: {
          create: returned.map(({ item, quantity }) => ({
            productId: item.productId,
            quantity,
            brand: item.brand,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
          })),
        },
      },
    })

    for (const { item, quantity } of returned) {
      const left = item.quantity - quantity
      if (left === 0) {
        await tx.saleItem.delete({ where: { id: item.id } })
      } else {
        await tx.saleItem.update({
          where: { id: item.id },
          data: {
            quantity: left,
            lineTotal: item.unitPrice.mul(left).toDecimalPlaces(2),
          },
        })
      }

      // Back into stock at the cost it left at. A product deleted since
      // comes back, so the stock isn't hidden.
      const product = await tx.product.findFirstOrThrow({
        where: { id: item.productId, userId },
      })
      await tx.product.update({
        where: { id: product.id },
        data: {
          quantityOnHand: product.quantityOnHand + quantity,
          avgCost: weightedAverageCost(
            product.quantityOnHand,
            product.avgCost,
            quantity,
            item.unitCost
          ),
          ...(product.deletedAt && { deletedAt: null, active: true }),
        },
      })
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: "RETURN",
          quantity,
          refId: saleReturn.id,
        },
      })
    }

    const newSubtotal = subtotal.sub(returnedValue)
    const newTotal = new Decimal(totals.newTotal)
    await tx.sale.update({
      where: { id: sale.id },
      data: {
        total: newTotal,
        discount: Decimal.max(newSubtotal.sub(newTotal), 0),
      },
    })
    if (refund.gt(0)) {
      const payment = await tx.payment.create({
        data: {
          saleId: sale.id,
          amount: refund.neg(),
          method: input.method,
          paidAt: input.date,
          note: "Refund for returned items",
        },
      })
      await postCash(tx, userId, {
        kind: "REFUND",
        amount: refund,
        occurredAt: input.date,
        method: payment.method,
        refType: "SALE",
        refId: sale.id,
        lineId: payment.id,
        description: `Refund to ${await customerLabel(tx, sale.customerId)} for returned items`,
      })
    }
    return { saleReturn, ...totals }
  })
}

/**
 * Removes a purchase recorded by mistake: its stock comes off, each
 * product's average cost goes back to what it was without it, and the money
 * returns to cash. Refused once any product has less stock than the
 * purchase added, since some of it may already be sold.
 */
export async function deletePurchase(userId: string, purchaseId: string) {
  return serializable(async (tx) => {
    const purchase = await tx.purchase.findFirst({
      where: { id: purchaseId, userId },
      include: { items: { include: { product: true } } },
    })
    if (!purchase) throw new LedgerError("That purchase no longer exists.")

    for (const item of purchase.items) {
      const { product } = item
      if (product.quantityOnHand < item.quantity) {
        throw new LedgerError(
          `${product.name} ${product.sizeMl}ml has ${product.quantityOnHand} in stock but this purchase added ${item.quantity}, so some of it is already sold.`
        )
      }
    }

    // One product can appear on a purchase once, so each update is final.
    for (const item of purchase.items) {
      const { product } = item
      await tx.product.update({
        where: { id: product.id },
        data: {
          quantityOnHand: product.quantityOnHand - item.quantity,
          avgCost: averageCostWithout(
            product.quantityOnHand,
            product.avgCost,
            item.quantity,
            item.unitCost
          ),
        },
      })
    }
    await tx.stockMovement.deleteMany({
      where: { type: "PURCHASE", refId: purchase.id },
    })
    await tx.purchase.delete({ where: { id: purchase.id } })
    await reverseCash(
      tx,
      userId,
      { refType: "PURCHASE", refId: purchase.id },
      "purchase deleted"
    )
    return purchase
  })
}

/**
 * Removes a completed sale recorded by mistake, with its payments and any
 * returns: what's still on it goes back into stock at the cost it left at,
 * and what was paid comes back out of cash, which can't go below zero.
 */
export async function deleteSale(userId: string, saleId: string) {
  return serializable(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, userId },
      include: { items: true },
    })
    if (!sale) throw new LedgerError("That sale no longer exists.")
    if (sale.status !== "COMPLETED") {
      throw new LedgerError("Only completed sales can be deleted here.")
    }
    // Loaded one at a time: several includes in one query run in parallel on
    // the transaction's single connection, which the pg driver warns about.
    const payments = await tx.payment.findMany({
      where: { saleId: sale.id },
      select: { amount: true },
    })
    const returns = await tx.saleReturn.findMany({
      where: { saleId: sale.id },
      select: { id: true },
    })

    const paid = payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Decimal(0)
    )
    if (paid.gt(0)) {
      const { cash } = await businessSummary(userId, tx)
      if (paid.gt(cash)) {
        throw new LedgerError(
          `The ${formatMoney(paid)} paid on this sale would come out of cash, but you have ${formatMoney(cash)}. Add capital first.`
        )
      }
    }

    for (const item of sale.items) {
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
          ...(product.deletedAt && { deletedAt: null, active: true }),
        },
      })
    }
    await tx.stockMovement.deleteMany({
      where: {
        OR: [
          { type: "SALE", refId: sale.id },
          { type: "RETURN", refId: { in: returns.map((r) => r.id) } },
        ],
      },
    })
    // Items, payments and returns go with it.
    await tx.sale.delete({ where: { id: sale.id } })
    await reverseCash(
      tx,
      userId,
      { refType: "SALE", refId: sale.id },
      "sale deleted"
    )
    return sale
  })
}

/**
 * Finds a payment the user may correct: theirs, on a live sale, and not a
 * refund (those belong to a return).
 */
async function correctablePayment(tx: Tx, userId: string, paymentId: string) {
  const payment = await tx.payment.findFirst({
    where: { id: paymentId, sale: { userId } },
    include: { sale: { include: { payments: true } } },
  })
  if (!payment) throw new LedgerError("That payment no longer exists.")
  if (payment.amount.lte(0)) {
    throw new LedgerError("A refund belongs to its return and can't be changed.")
  }
  if (payment.sale.status !== "COMPLETED" && payment.sale.status !== "PREORDER") {
    throw new LedgerError("Payments on a cancelled sale can't be changed.")
  }
  const others = payment.sale.payments
    .filter((other) => other.id !== payment.id)
    .reduce((sum, other) => sum.add(other.amount), new Decimal(0))
  return { payment, others }
}

/**
 * Corrects a payment. It can't take the sale past its total or below what
 * was refunded, and lowering it can't take cash below zero.
 */
export async function updatePayment(
  userId: string,
  paymentId: string,
  input: {
    amount: Prisma.Decimal | string | number
    method: PaymentMethod
    paidAt: Date
    note: string | null
  }
) {
  const amount = new Decimal(input.amount)
  if (amount.lte(0)) throw new LedgerError("Payment must be more than zero.")

  return serializable(async (tx) => {
    const { payment, others } = await correctablePayment(tx, userId, paymentId)
    const most = payment.sale.total.sub(others)
    if (amount.gt(most)) {
      throw new LedgerError(
        `At most ${formatMoney(Decimal.max(most, 0))} can be paid on this sale.`
      )
    }
    if (others.add(amount).lt(0)) {
      throw new LedgerError(
        `More than that was refunded, so this must be at least ${formatMoney(others.neg())}.`
      )
    }
    const less = payment.amount.sub(amount)
    if (less.gt(0)) {
      const { cash } = await businessSummary(userId, tx)
      if (less.gt(cash)) {
        throw new LedgerError(
          `Lowering this by ${formatMoney(less)} would take your cash below zero. You have ${formatMoney(cash)}.`
        )
      }
    }
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        amount,
        method: input.method,
        paidAt: input.paidAt,
        note: input.note,
      },
    })
    await replaceCash(
      tx,
      userId,
      {
        kind: "SALE_PAYMENT",
        amount,
        occurredAt: updated.paidAt,
        method: updated.method,
        refType: "SALE",
        refId: payment.saleId,
        lineId: payment.id,
        description: `Payment from ${await customerLabel(tx, payment.sale.customerId)}`,
      },
      "payment edited"
    )
    return updated
  })
}

/** Removes a payment recorded by mistake; its money comes out of cash. */
export async function deletePayment(userId: string, paymentId: string) {
  return serializable(async (tx) => {
    const { payment, others } = await correctablePayment(tx, userId, paymentId)
    if (others.lt(0)) {
      throw new LedgerError(
        "Part of this was refunded on a return, so it can't be deleted. Lower it instead."
      )
    }
    const { cash } = await businessSummary(userId, tx)
    if (payment.amount.gt(cash)) {
      throw new LedgerError(
        `This ${formatMoney(payment.amount)} would come out of cash, but you have ${formatMoney(cash)}.`
      )
    }
    await tx.payment.delete({ where: { id: payment.id } })
    await reverseCash(
      tx,
      userId,
      { refType: "SALE", refId: payment.saleId, lineId: payment.id },
      "payment deleted"
    )
    return payment
  })
}
