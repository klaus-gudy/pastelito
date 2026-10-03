"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { auth } from "@/auth"
import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { productSchema } from "@/lib/validations/product"

const fields = ["name", "brand", "sizeMl", "sku", "sellingPrice"] as const
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
  const session = await auth()
  if (!session?.user?.id) redirect("/sign-in")

  const values = Object.fromEntries(
    fields.map((field) => [field, String(formData.get(field) ?? "")])
  ) as Record<Field, string>

  const parsed = productSchema.safeParse(values)
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const { name, sizeMl } = parsed.data
  try {
    await prisma.product.create({
      data: { ...parsed.data, userId: session.user.id },
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
