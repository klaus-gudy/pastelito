"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { dayToDate } from "@/lib/dates"
import { withDbErrors } from "@/lib/db-errors"
import { formatMoney } from "@/lib/format"
import { Prisma } from "@/lib/generated/prisma/client"
import { recordReceivedPurchase } from "@/lib/ledger"
import { readyPreorderIds } from "@/lib/preorders"
import { prisma } from "@/lib/prisma"
import { businessSummary } from "@/lib/reports"
import { issuesByPath } from "@/lib/validations/common"
import { purchaseSchema, supplierSchema } from "@/lib/validations/purchase"

export type PurchaseFormState =
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

export async function createPurchase(
  _state: PurchaseFormState,
  formData: FormData
): Promise<PurchaseFormState> {
  return withDbErrors<PurchaseFormState>(async () => {
    const user = await requireUser()

    const parsed = purchaseSchema.safeParse({
      supplierName: String(formData.get("supplierName") ?? ""),
      date: String(formData.get("date") ?? ""),
      method: String(formData.get("method") ?? ""),
      note: String(formData.get("note") ?? ""),
      items: parseItems(formData.get("items")),
    })
    if (!parsed.success) return { errors: issuesByPath(parsed.error) }
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE }

    const { items } = parsed.data
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

    // Purchases are paid from cash, so cash can never go below zero.
    const cost = items.reduce(
      (sum, item) => sum.add(new Prisma.Decimal(item.unitCost).mul(item.quantity)),
      new Prisma.Decimal(0)
    )
    const { cash } = await businessSummary(user.id)
    if (cost.gt(cash)) {
      return {
        message: cash.gt(0)
          ? `Not enough cash: this purchase costs ${formatMoney(cost)} but you have ${formatMoney(cash)}. Add capital first.`
          : `You have no cash to buy with. Add capital first.`,
      }
    }

    const purchase = await recordReceivedPurchase(user.id, {
      ...parsed.data,
      date: dayToDate(parsed.data.date),
    })

    revalidatePath("/purchases")
    revalidatePath("/products")
    revalidatePath("/preorders")
    const units = items.reduce((sum, item) => sum + item.quantity, 0)
    // New stock may let waiting preorders go out.
    const ready = (await readyPreorderIds(user.id)).size
    const readyNote =
      ready === 0
        ? ""
        : ready === 1
          ? " 1 preorder is ready to deliver."
          : ` ${ready} preorders are ready to deliver.`
    return {
      success: true,
      message: `Purchase recorded: ${units} ${units === 1 ? "unit" : "units"} for ${formatMoney(purchase.total)}.${readyNote}`,
    }
  })
}

export type SupplierFormState =
  | {
      errors?: Partial<Record<"name" | "phone", string[]>>
      values?: { name: string; phone: string }
      success?: boolean
      message?: string
    }
  | undefined

export async function createSupplier(
  _state: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  return withDbErrors<SupplierFormState>(async () => {
    const user = await requireUser()
    const values = {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    }

    const parsed = supplierSchema.safeParse(values)
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors, values }
    }
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE, values }

    const duplicate = await prisma.supplier.findFirst({
      where: {
        userId: user.id,
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
      select: { name: true },
    })
    if (duplicate) {
      return {
        errors: { name: [`You already have ${duplicate.name}.`] },
        values,
      }
    }

    await prisma.supplier.create({ data: { ...parsed.data, userId: user.id } })
    revalidatePath("/purchases")
    return { success: true, message: `${parsed.data.name} added.` }
  })
}

export type QuickSupplierResult = {
  supplier?: { id: string; name: string }
  message?: string
}

/**
 * Saves a supplier from just a name, e.g. while recording a purchase. An
 * existing supplier with the same name is returned instead of a duplicate.
 */
export async function addSupplierByName(
  name: string
): Promise<QuickSupplierResult> {
  return withDbErrors<QuickSupplierResult>(async () => {
    const user = await requireUser()
    const parsed = supplierSchema.shape.name.safeParse(name)
    if (!parsed.success) return { message: parsed.error.issues[0].message }
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE }

    const existing = await prisma.supplier.findFirst({
      where: {
        userId: user.id,
        name: { equals: parsed.data, mode: "insensitive" },
      },
      select: { id: true, name: true },
    })
    if (existing) return { supplier: existing }

    const supplier = await prisma.supplier.create({
      data: { name: parsed.data, userId: user.id },
      select: { id: true, name: true },
    })
    revalidatePath("/purchases")
    return { supplier }
  })
}
