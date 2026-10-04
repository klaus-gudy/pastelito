"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { dayToDate } from "@/lib/dates"
import { formatMoney } from "@/lib/format"
import { recordReceivedPurchase } from "@/lib/ledger"
import { prisma } from "@/lib/prisma"
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

  const purchase = await recordReceivedPurchase(user.id, {
    ...parsed.data,
    date: dayToDate(parsed.data.date),
  })

  revalidatePath("/purchases")
  revalidatePath("/products")
  const units = items.reduce((sum, item) => sum + item.quantity, 0)
  return {
    success: true,
    message: `Purchase recorded: ${units} ${units === 1 ? "unit" : "units"} for ${formatMoney(purchase.total)}.`,
  }
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
}
