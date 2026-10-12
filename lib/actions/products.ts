"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { withDbErrors } from "@/lib/db-errors"
import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { generateSku } from "@/lib/sku"
import { productSchema } from "@/lib/validations/product"

const fields = ["name", "sizeMl", "buyingPrice", "sellingPrice"] as const
type Field = (typeof fields)[number]

export type ProductFormState =
  | {
      errors?: Partial<Record<Field, string[]>>
      values?: Partial<Record<Field, string>>
      success?: boolean
      message?: string
    }
  | undefined

export async function createProduct(
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  return withDbErrors<ProductFormState>(async () => {
    const user = await requireUser()

    const values = Object.fromEntries(
      fields.map((field) => [field, String(formData.get(field) ?? "")])
    ) as Record<Field, string>

    const parsed = productSchema.safeParse(values)
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors, values }
    }

    if (!user.verified) return { message: VERIFY_TO_SAVE, values }

    const { name, sizeMl } = parsed.data
    // Adding a product you deleted earlier brings it back with its history.
    const deleted = await prisma.product.findFirst({
      where: { userId: user.id, name, sizeMl, deletedAt: { not: null } },
      select: { id: true },
    })
    try {
      const data = { ...parsed.data, sku: generateSku(name, sizeMl) }
      if (deleted) {
        await prisma.product.update({
          where: { id: deleted.id },
          data: { ...data, active: true, deletedAt: null },
        })
      } else {
        await prisma.product.create({ data: { ...data, userId: user.id } })
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return {
          errors: { sizeMl: [`You already have ${name} in ${sizeMl} ml.`] },
          values,
        }
      }
      throw error
    }

    revalidatePath("/products")
    return { success: true, message: `${name} ${sizeMl} ml added.` }
  })
}

export async function updateProduct(
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  return withDbErrors<ProductFormState>(async () => {
    const user = await requireUser()
    const id = String(formData.get("id") ?? "")

    const values = Object.fromEntries(
      fields.map((field) => [field, String(formData.get(field) ?? "")])
    ) as Record<Field, string>

    const parsed = productSchema.safeParse(values)
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors, values }
    }

    if (!user.verified) return { message: VERIFY_TO_SAVE, values }

    const product = await prisma.product.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      select: { id: true },
    })
    if (!product) return { message: "That product no longer exists.", values }

    const { name, sizeMl } = parsed.data
    try {
      await prisma.product.update({
        where: { id: product.id },
        data: { ...parsed.data, sku: generateSku(name, sizeMl) },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return {
          errors: { sizeMl: [`You already have ${name} in ${sizeMl} ml.`] },
          values,
        }
      }
      throw error
    }

    revalidatePath("/products")
    // Names show on purchases, sales and preorders too.
    revalidatePath("/purchases")
    revalidatePath("/sales")
    revalidatePath("/preorders")
    return { success: true, message: `${name} ${sizeMl} ml updated.` }
  })
}

export type DeleteProductResult = { success?: boolean; message: string }

/**
 * Soft-deletes a product: it leaves the list and every picker, and its past
 * sales and purchases stay. Refused while it still has stock or sits on an
 * open preorder or draft, so nothing is left pointing at a product you can
 * no longer open.
 */
export async function deleteProduct(id: string): Promise<DeleteProductResult> {
  return withDbErrors<DeleteProductResult>(async () => {
    const user = await requireUser()
    if (!user.verified) return { message: VERIFY_TO_SAVE }

    const product = await prisma.product.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      select: { id: true, name: true, sizeMl: true, quantityOnHand: true },
    })
    if (!product) return { message: "That product no longer exists." }

    const [openSales, openPurchases] = await Promise.all([
      prisma.saleItem.count({
        where: {
          productId: product.id,
          sale: { status: { in: ["DRAFT", "PREORDER"] } },
        },
      }),
      prisma.purchaseItem.count({
        where: { productId: product.id, purchase: { status: "DRAFT" } },
      }),
    ])
    const blockers = [
      product.quantityOnHand > 0 && `still has ${product.quantityOnHand} in stock`,
      openSales > 0 && "is on a preorder that isn't finished",
      openPurchases > 0 && "is on a purchase that isn't received",
    ].filter(Boolean)
    const label = `${product.name} ${product.sizeMl} ml`
    if (blockers.length > 0) {
      return {
        message: `${label} ${blockers.join(" and ")}. Settle that before deleting.`,
      }
    }

    // Inactive too, so every picker and report that skips inactive products
    // skips this one.
    await prisma.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date(), active: false },
    })
    for (const path of [
      "/products",
      "/purchases",
      "/sales",
      "/preorders",
      "/customers",
    ]) {
      revalidatePath(path)
    }
    return { success: true, message: `${label} deleted.` }
  })
}
