"use server"

import { revalidatePath } from "next/cache"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { dayToDate } from "@/lib/dates"
import { withDbErrors } from "@/lib/db-errors"
import { formatMoney } from "@/lib/format"
import { LedgerError, recordCompletedSale } from "@/lib/ledger"
import { prisma } from "@/lib/prisma"
import { issuesByPath } from "@/lib/validations/common"
import { saleSchema } from "@/lib/validations/sale"

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

export async function createSale(
  _state: SaleFormState,
  formData: FormData
): Promise<SaleFormState> {
  return withDbErrors<SaleFormState>(async () => {
    const user = await requireUser()

    const parsed = saleSchema.safeParse({
      customerId: String(formData.get("customerId") ?? ""),
      date: String(formData.get("date") ?? ""),
      discount: String(formData.get("discount") ?? ""),
      amountPaid: String(formData.get("amountPaid") ?? ""),
      method: String(formData.get("method") ?? ""),
      note: String(formData.get("note") ?? ""),
      items: parseItems(formData.get("items")),
    })
    if (!parsed.success) return { errors: issuesByPath(parsed.error) }
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE }

    const { items, customerId, discount, amountPaid, method, ...rest } =
      parsed.data
    const products = await prisma.product.findMany({
      where: {
        userId: user.id,
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
    if (missing.length > 0) return { errors: Object.fromEntries(missing) }

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
