"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { withDbErrors } from "@/lib/db-errors"
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
  return withDbErrors<CustomerFormState>(async () => {
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
        // Deleted customers' numbers can be reused.
        where: { userId: user.id, phone: parsed.data.phone, deletedAt: null },
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
  })
}

export async function updateCustomer(
  _state: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  return withDbErrors<CustomerFormState>(async () => {
    const user = await requireUser()
    const id = String(formData.get("id") ?? "")
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

    const customer = await prisma.customer.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      select: { id: true },
    })
    if (!customer) return { message: "That customer no longer exists.", values }

    // A phone number belongs to one customer.
    if (parsed.data.phone) {
      const existing = await prisma.customer.findFirst({
        where: {
          userId: user.id,
          phone: parsed.data.phone,
          id: { not: customer.id },
          deletedAt: null,
        },
        select: { name: true },
      })
      if (existing) {
        return {
          errors: { phone: [`This number is already saved for ${existing.name}.`] },
          values,
        }
      }
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: parsed.data,
    })
    revalidatePath("/customers")
    revalidatePath(`/customers/${customer.id}`)
    // Names show on sales and preorders too.
    revalidatePath("/sales")
    revalidatePath("/preorders")
    return { success: true, message: `${parsed.data.name} updated.` }
  })
}

export type QuickCustomerResult = {
  customer?: { id: string; name: string }
  message?: string
}

/** Saves a customer from just a name, e.g. while recording a sale. */
export async function addCustomerByName(
  name: string
): Promise<QuickCustomerResult> {
  return withDbErrors<QuickCustomerResult>(async () => {
    const user = await requireUser()
    const parsed = customerSchema.shape.name.safeParse(name)
    if (!parsed.success) return { message: parsed.error.issues[0].message }
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE }

    const customer = await prisma.customer.create({
      data: { name: parsed.data, userId: user.id },
      select: { id: true, name: true },
    })
    revalidatePath("/customers")
    return { customer }
  })
}
