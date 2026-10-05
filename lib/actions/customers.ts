"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { customerSchema } from "@/lib/validations/customer"

type Field = "name" | "phone" | "email"

export type CustomerFormState =
  | {
      errors?: Partial<Record<Field, string[]>>
      values?: Record<Field, string>
      success?: boolean
      message?: string
    }
  | undefined

export async function createCustomer(
  _state: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await requireUser()
  const values = {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
  }

  const parsed = customerSchema.safeParse(values)
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values }
  }
  if (!user.emailVerified) return { message: VERIFY_TO_SAVE, values }

  // Names can repeat; a phone number belongs to one customer.
  if (parsed.data.phone) {
    const existing = await prisma.customer.findFirst({
      where: { userId: user.id, phone: parsed.data.phone },
      select: { name: true },
    })
    if (existing) {
      return {
        errors: { phone: [`This number is already saved for ${existing.name}.`] },
        values,
      }
    }
  }

  await prisma.customer.create({ data: { ...parsed.data, userId: user.id } })
  revalidatePath("/customers")
  return { success: true, message: `${parsed.data.name} added.` }
}

/** Saves a customer from just a name, e.g. while recording a sale. */
export async function addCustomerByName(
  name: string
): Promise<{ customer?: { id: string; name: string }; error?: string }> {
  const user = await requireUser()
  const parsed = customerSchema.shape.name.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!user.emailVerified) return { error: VERIFY_TO_SAVE }

  const customer = await prisma.customer.create({
    data: { name: parsed.data, userId: user.id },
    select: { id: true, name: true },
  })
  revalidatePath("/customers")
  return { customer }
}
