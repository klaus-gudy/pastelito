"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
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
  const user = await requireUser()

  const values = Object.fromEntries(
    fields.map((field) => [field, String(formData.get(field) ?? "")])
  ) as Record<Field, string>

  const parsed = productSchema.safeParse(values)
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values }
  }

  if (!user.emailVerified) return { message: VERIFY_TO_SAVE, values }

  const { name, sizeMl } = parsed.data
  try {
    await prisma.product.create({
      data: {
        ...parsed.data,
        sku: generateSku(name, sizeMl),
        userId: user.id,
      },
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
  return { success: true, message: `${name} ${sizeMl} ml added.` }
}
