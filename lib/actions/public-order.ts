"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { dayToDate, todayIso } from "@/lib/dates"
import { withDbErrors } from "@/lib/db-errors"
import { isVerified } from "@/lib/email-verification"
import { formatMoney } from "@/lib/format"
import { LedgerError, recordPreorder } from "@/lib/ledger"
import { prisma } from "@/lib/prisma"
import { clientIp, hit, limits } from "@/lib/rate-limit"
import { issuesByPath } from "@/lib/validations/common"
import { publicOrderSchema } from "@/lib/validations/public-order"

export type PublicOrderFormState =
  | {
      errors?: Record<string, string[]>
      success?: boolean
      message?: string
    }
  | undefined

const CLOSED = "This shop isn't taking orders online right now."

function parseItems(raw: FormDataEntryValue | null) {
  try {
    const items = JSON.parse(String(raw ?? "[]"))
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

/**
 * Records a preorder sent by a customer from the shop's public order page.
 * No sign-in: the customer is matched by phone number, or added.
 */
export async function submitPublicOrder(
  _state: PublicOrderFormState,
  formData: FormData
): Promise<PublicOrderFormState> {
  return withDbErrors<PublicOrderFormState>(async () => {
    const allowed = await hit(
      `public-order:ip:${clientIp(await headers())}`,
      limits.publicOrderPerIp
    )
    if (!allowed) {
      return { message: "Too many orders from this device. Try again later." }
    }

    const parsed = publicOrderSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      note: String(formData.get("note") ?? ""),
      items: parseItems(formData.get("items")),
    })
    if (!parsed.success) return { errors: issuesByPath(parsed.error) }

    const shop = await prisma.user.findUnique({
      where: { orderSlug: String(formData.get("shop") ?? "") },
      select: { id: true, emailVerified: true },
    })
    if (!shop || !isVerified(shop)) return { message: CLOSED }

    const { name, phone, note, items } = parsed.data
    const products = await prisma.product.findMany({
      where: {
        userId: shop.id,
        active: true,
        id: { in: items.map((item) => item.productId) },
      },
      select: { id: true, sellingPrice: true },
    })
    const priceOf = new Map(products.map((p) => [p.id, p.sellingPrice]))
    const missing = items.flatMap((item, index) =>
      priceOf.has(item.productId)
        ? []
        : [[`items.${index}.productId`, ["That product is no longer available."]]]
    )
    if (missing.length > 0) return { errors: Object.fromEntries(missing) }

    // A phone number belongs to one customer, so a returning customer's
    // orders land on their existing record.
    const customer =
      (await prisma.customer.findFirst({
        where: { userId: shop.id, phone, deletedAt: null },
        select: { id: true },
      })) ??
      (await prisma.customer.create({
        data: { userId: shop.id, name, phone },
        select: { id: true },
      }))

    try {
      const preorder = await recordPreorder(shop.id, {
        customerId: customer.id,
        date: dayToDate(todayIso()),
        discount: 0,
        note: note ? `Online order: ${note}` : "Online order",
        items: items.map((item) => ({
          ...item,
          unitPrice: priceOf.get(item.productId)!,
        })),
        deposit: null,
      })

      revalidatePath("/preorders")
      revalidatePath("/customers", "layout")
      return {
        success: true,
        message: `Order sent: ${formatMoney(preorder.total)}. The shop will contact you.`,
      }
    } catch (error) {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    }
  })
}
