"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { withDbErrors } from "@/lib/db-errors"
import { formatMoney } from "@/lib/format"
import { Prisma } from "@/lib/generated/prisma/client"
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

export type DeleteCustomerResult = { success?: boolean; message: string }

/**
 * Soft-deletes a customer: they leave lists and pickers, their sales stay.
 * Refused while they owe money or have preorders waiting, so no debt or
 * order is left pointing at someone you can no longer open.
 */
export async function deleteCustomer(id: string): Promise<DeleteCustomerResult> {
  return withDbErrors<DeleteCustomerResult>(async () => {
    const user = await requireUser()
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE }

    const customer = await prisma.customer.findFirst({
      where: { id, userId: user.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        sales: {
          where: { status: { in: ["COMPLETED", "PREORDER"] } },
          select: {
            status: true,
            total: true,
            payments: { select: { amount: true } },
          },
        },
      },
    })
    if (!customer) return { message: "That customer no longer exists." }

    const waiting = customer.sales.filter((sale) => sale.status === "PREORDER")
    const completed = customer.sales.filter(
      (sale) => sale.status === "COMPLETED"
    )
    const amounts = completed.flatMap((sale) => [
      sale.total,
      ...sale.payments.map((payment) => payment.amount.neg()),
    ])
    // Completed totals minus what was paid on them.
    const owes = amounts.reduce(
      (sum, amount) => sum.add(amount),
      new Prisma.Decimal(0)
    )
    const blockers = [
      owes.gt(0) && `still owes ${formatMoney(owes)}`,
      waiting.length > 0 &&
        `has ${waiting.length} ${waiting.length === 1 ? "preorder" : "preorders"} waiting`,
    ].filter(Boolean)
    if (blockers.length > 0) {
      return {
        message: `${customer.name} ${blockers.join(" and ")}. Settle that before deleting.`,
      }
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { deletedAt: new Date() },
    })
    revalidatePath("/customers")
    revalidatePath("/sales")
    revalidatePath("/preorders")
    return { success: true, message: `${customer.name} deleted.` }
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
