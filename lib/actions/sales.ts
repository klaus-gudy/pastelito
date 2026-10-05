"use server"

import { revalidatePath } from "next/cache"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { dayToDate } from "@/lib/dates"
import { withDbErrors } from "@/lib/db-errors"
import { formatMoney } from "@/lib/format"
import {
  cancelSale,
  completeSale,
  LedgerError,
  recordCompletedSale,
  recordPayment,
  recordPreorder,
} from "@/lib/ledger"
import { prisma } from "@/lib/prisma"
import { issuesByPath } from "@/lib/validations/common"
import {
  deliverySchema,
  salePaymentSchema,
  saleSchema,
} from "@/lib/validations/sale"

export type SaleFormState =
  | {
      errors?: Record<string, string[]>
      success?: boolean
      message?: string
    }
  | undefined

function parseItems(raw: FormDataEntryValue | null) {
  try {
    const items = JSON.parse(String(raw ?? "[]"))
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

/**
 * Validates a sale or preorder form and checks its products still exist.
 * Returns the parsed sale, or the form state to send back.
 */
async function parseSaleForm(userId: string, formData: FormData) {
  const parsed = saleSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    date: String(formData.get("date") ?? ""),
    discount: String(formData.get("discount") ?? ""),
    amountPaid: String(formData.get("amountPaid") ?? ""),
    method: String(formData.get("method") ?? ""),
    note: String(formData.get("note") ?? ""),
    items: parseItems(formData.get("items")),
  })
  if (!parsed.success) return { state: { errors: issuesByPath(parsed.error) } }

  const { items } = parsed.data
  const products = await prisma.product.findMany({
    where: {
      userId,
      active: true,
      id: { in: items.map((item) => item.productId) },
    },
    select: { id: true },
  })
  const known = new Set(products.map((product) => product.id))
  const missing = items.flatMap((item, index) =>
    known.has(item.productId)
      ? []
      : [[`items.${index}.productId`, ["That product is no longer available."]]]
  )
  if (missing.length > 0) return { state: { errors: Object.fromEntries(missing) } }
  return { sale: parsed.data }
}

export async function createSale(
  _state: SaleFormState,
  formData: FormData
): Promise<SaleFormState> {
  return withDbErrors<SaleFormState>(async () => {
    const user = await requireUser()

    const { sale: parsed, state } = await parseSaleForm(user.id, formData)
    if (!parsed) return state
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE }

    const { items, customerId, discount, amountPaid, method, ...rest } = parsed
    try {
      const sale = await recordCompletedSale(user.id, {
        ...rest,
        customerId,
        date: dayToDate(rest.date),
        discount: discount ?? 0,
        items,
        payment: amountPaid ? { amount: amountPaid, method } : null,
      })

      revalidatePath("/sales")
      revalidatePath("/products")
      revalidatePath("/customers")
      const owed = sale.total.sub(amountPaid ?? 0)
      return {
        success: true,
        message: owed.gt(0)
          ? `Sale recorded: ${formatMoney(sale.total)}, ${formatMoney(owed)} still owed.`
          : `Sale recorded: ${formatMoney(sale.total)}.`,
      }
    } catch (error) {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    }
  })
}

export async function createPreorder(
  _state: SaleFormState,
  formData: FormData
): Promise<SaleFormState> {
  return withDbErrors<SaleFormState>(async () => {
    const user = await requireUser()

    const { sale: parsed, state } = await parseSaleForm(user.id, formData)
    if (!parsed) return state
    const { items, customerId, discount, amountPaid, method, ...rest } = parsed
    if (!customerId) {
      return { errors: { customerId: ["A preorder needs a customer."] } }
    }
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE }

    try {
      const preorder = await recordPreorder(user.id, {
        ...rest,
        customerId,
        date: dayToDate(rest.date),
        discount: discount ?? 0,
        items,
        deposit: amountPaid ? { amount: amountPaid, method } : null,
      })

      revalidatePath("/preorders")
      revalidatePath("/customers")
      return {
        success: true,
        message: amountPaid
          ? `Preorder recorded: ${formatMoney(preorder.total)}, ${formatMoney(amountPaid)} deposit.`
          : `Preorder recorded: ${formatMoney(preorder.total)}.`,
      }
    } catch (error) {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    }
  })
}

/**
 * Hands a preorder over: takes its stock and moves it to sales on the delivery
 * day, collecting any payment made on the spot.
 */
export async function deliverPreorder(
  _state: SaleFormState,
  formData: FormData
): Promise<SaleFormState> {
  return withDbErrors<SaleFormState>(async () => {
    const user = await requireUser()

    const parsed = deliverySchema.safeParse({
      date: String(formData.get("date") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      method: String(formData.get("method") ?? ""),
    })
    if (!parsed.success) return { errors: issuesByPath(parsed.error) }
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE }

    const { date, amount, method } = parsed.data
    let sale
    try {
      sale = await completeSale(user.id, String(formData.get("saleId") ?? ""), {
        date: dayToDate(date),
        payment: amount ? { amount, method } : null,
      })
    } catch (error) {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    }

    revalidatePath("/preorders")
    revalidatePath("/sales")
    revalidatePath("/products")
    revalidatePath("/customers")
    const paid = await prisma.payment.aggregate({
      where: { saleId: sale.id },
      _sum: { amount: true },
    })
    const owed = sale.total.sub(paid._sum.amount ?? 0)
    return {
      success: true,
      message: owed.gt(0)
        ? `Delivered and moved to sales; ${formatMoney(owed)} still owed.`
        : "Delivered and moved to sales.",
    }
  })
}

export async function cancelPreorder(saleId: string): Promise<SaleFormState> {
  return withDbErrors<SaleFormState>(async () => {
    const user = await requireUser()
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE }

    try {
      await cancelSale(user.id, saleId)
    } catch (error) {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    }

    revalidatePath("/preorders")
    revalidatePath("/customers")
    return { success: true, message: "Preorder cancelled." }
  })
}

export async function recordSalePayment(
  _state: SaleFormState,
  formData: FormData
): Promise<SaleFormState> {
  return withDbErrors<SaleFormState>(async () => {
    const user = await requireUser()

    const parsed = salePaymentSchema.safeParse({
      amount: String(formData.get("amount") ?? ""),
      method: String(formData.get("method") ?? ""),
      date: String(formData.get("date") ?? ""),
      note: String(formData.get("note") ?? ""),
    })
    if (!parsed.success) return { errors: issuesByPath(parsed.error) }
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE }

    const { amount, method, date, note } = parsed.data
    try {
      await recordPayment(user.id, String(formData.get("saleId") ?? ""), {
        amount,
        method,
        paidAt: dayToDate(date),
        note: note ?? undefined,
      })
    } catch (error) {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    }

    revalidatePath("/sales")
    revalidatePath("/preorders")
    revalidatePath("/customers")
    return {
      success: true,
      message: `Payment of ${formatMoney(amount)} recorded.`,
    }
  })
}
