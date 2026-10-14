"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { dayToDate } from "@/lib/dates"
import { withDbErrors } from "@/lib/db-errors"
import { formatMoney } from "@/lib/format"
import { LedgerError, recordReceivedPurchase } from "@/lib/ledger"
import { readyPreorderIds } from "@/lib/preorders"
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
    if (!user.verified) return { message: VERIFY_TO_SAVE }

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

    let purchase
    try {
      purchase = await recordReceivedPurchase(user.id, {
        ...parsed.data,
        date: dayToDate(parsed.data.date),
      })
    } catch (error) {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    }

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
    if (!user.verified) return { message: VERIFY_TO_SAVE, values }

    const duplicate = await prisma.supplier.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
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

    // Adding a supplier you deleted earlier brings it back with its history.
    const deleted = await prisma.supplier.findFirst({
      where: {
        userId: user.id,
        deletedAt: { not: null },
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
      select: { id: true },
    })
    if (deleted) {
      await prisma.supplier.update({
        where: { id: deleted.id },
        data: { ...parsed.data, deletedAt: null },
      })
    } else {
      await prisma.supplier.create({
        data: { ...parsed.data, userId: user.id },
      })
    }
    revalidatePath("/purchases")
    return { success: true, message: `${parsed.data.name} added.` }
  })
}

export async function updateSupplier(
  _state: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  return withDbErrors<SupplierFormState>(async () => {
    const user = await requireUser()
    const id = String(formData.get("id") ?? "")
    const values = {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    }

    const parsed = supplierSchema.safeParse(values)
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors, values }
    }
    if (!user.verified) return { message: VERIFY_TO_SAVE, values }

    const supplier = await prisma.supplier.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      select: { id: true },
    })
    if (!supplier) return { message: "That supplier no longer exists.", values }

    const duplicate = await prisma.supplier.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
        id: { not: supplier.id },
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

    await prisma.supplier.update({
      where: { id: supplier.id },
      data: parsed.data,
    })
    revalidatePath("/purchases")
    return { success: true, message: `${parsed.data.name} updated.` }
  })
}

export type DeleteSupplierResult = { success?: boolean; message: string }

/**
 * Soft-deletes a supplier: it leaves the list and the purchase picker, and
 * its purchases keep showing who they were bought from.
 */
export async function deleteSupplier(id: string): Promise<DeleteSupplierResult> {
  return withDbErrors<DeleteSupplierResult>(async () => {
    const user = await requireUser()
    if (!user.verified) return { message: VERIFY_TO_SAVE }

    const supplier = await prisma.supplier.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      select: { id: true, name: true },
    })
    if (!supplier) return { message: "That supplier no longer exists." }

    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { deletedAt: new Date() },
    })
    revalidatePath("/purchases")
    return { success: true, message: `${supplier.name} deleted.` }
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
    if (!user.verified) return { message: VERIFY_TO_SAVE }

    // A live supplier first; else a deleted one by that name comes back.
    const existing = await prisma.supplier.findFirst({
      where: {
        userId: user.id,
        name: { equals: parsed.data, mode: "insensitive" },
      },
      orderBy: { deletedAt: { sort: "asc", nulls: "first" } },
      select: { id: true, name: true, deletedAt: true },
    })
    if (existing) {
      if (existing.deletedAt) {
        await prisma.supplier.update({
          where: { id: existing.id },
          data: { deletedAt: null },
        })
        revalidatePath("/purchases")
      }
      return { supplier: { id: existing.id, name: existing.name } }
    }

    const supplier = await prisma.supplier.create({
      data: { name: parsed.data, userId: user.id },
      select: { id: true, name: true },
    })
    revalidatePath("/purchases")
    return { supplier }
  })
}
