"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { capitalTotals } from "@/lib/capital"
import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { dayToDate } from "@/lib/dates"
import { formatMoney } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import {
  capitalEntrySchema,
  capitalSourceSchema,
} from "@/lib/validations/capital"

export type CapitalFormState =
  | {
      errors?: Partial<Record<string, string[]>>
      values?: Record<string, string>
      success?: boolean
      message?: string
    }
  | undefined

const read = (formData: FormData, fields: readonly string[]) =>
  Object.fromEntries(
    fields.map((field) => [field, String(formData.get(field) ?? "")])
  )

export async function createCapitalSource(
  _state: CapitalFormState,
  formData: FormData
): Promise<CapitalFormState> {
  const user = await requireUser()
  const values = read(formData, [
    "name",
    "type",
    "note",
    "amount",
    "method",
    "date",
  ])

  const source = capitalSourceSchema.safeParse(values)
  // The first amount is optional; only validate it when one was typed.
  const withAmount = values.amount.replace(/[,\s]/g, "") !== ""
  const entry = withAmount ? capitalEntrySchema.safeParse(values) : null
  if (!source.success || (entry && !entry.success)) {
    return {
      errors: {
        ...(source.success ? {} : z.flattenError(source.error).fieldErrors),
        ...(entry && !entry.success
          ? z.flattenError(entry.error).fieldErrors
          : {}),
      },
      values,
    }
  }
  if (!user.emailVerified) return { message: VERIFY_TO_SAVE, values }

  const duplicate = await prisma.capitalSource.findFirst({
    where: {
      userId: user.id,
      name: { equals: source.data.name, mode: "insensitive" },
    },
    select: { name: true },
  })
  if (duplicate) {
    return {
      errors: { name: [`You already have ${duplicate.name}.`] },
      values,
    }
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.capitalSource.create({
      data: { ...source.data, userId: user.id },
    })
    if (entry?.success) {
      await tx.capitalEntry.create({
        data: {
          userId: user.id,
          sourceId: created.id,
          type: "RECEIVED",
          amount: entry.data.amount,
          method: entry.data.method,
          date: dayToDate(entry.data.date),
          note: entry.data.note,
        },
      })
    }
  })

  revalidatePath("/capital")
  return { success: true, message: `${source.data.name} added.` }
}

export async function recordCapitalEntry(
  _state: CapitalFormState,
  formData: FormData
): Promise<CapitalFormState> {
  const user = await requireUser()
  const values = read(formData, [
    "sourceId",
    "type",
    "amount",
    "method",
    "date",
    "note",
  ])
  const type = values.type === "REPAID" ? "REPAID" : "RECEIVED"

  const parsed = capitalEntrySchema.safeParse(values)
  if (!parsed.success || !values.sourceId) {
    return {
      errors: {
        ...(parsed.success ? {} : z.flattenError(parsed.error).fieldErrors),
        ...(values.sourceId ? {} : { sourceId: ["Pick a source."] }),
      },
      values,
    }
  }
  if (!user.emailVerified) return { message: VERIFY_TO_SAVE, values }

  const result = await prisma.$transaction(async (tx) => {
    const source = await tx.capitalSource.findFirst({
      where: { id: values.sourceId, userId: user.id },
    })
    if (!source) return { message: "That capital source no longer exists." }

    if (type === "REPAID") {
      const totals = (await capitalTotals(user.id, tx)).get(source.id)
      const outstanding = totals
        ? totals.received.sub(totals.repaid)
        : null
      if (!outstanding || outstanding.lte(0)) {
        return { message: `Nothing is outstanding to ${source.name}.` }
      }
      if (outstanding.lt(parsed.data.amount)) {
        return {
          errors: {
            amount: [`Only ${formatMoney(outstanding)} is outstanding.`],
          },
        }
      }
    }

    await tx.capitalEntry.create({
      data: {
        userId: user.id,
        sourceId: source.id,
        type,
        amount: parsed.data.amount,
        method: parsed.data.method,
        date: dayToDate(parsed.data.date),
        note: parsed.data.note,
      },
    })
    return {
      success: true,
      message:
        type === "REPAID"
          ? `Repayment to ${source.name} recorded.`
          : `Money from ${source.name} recorded.`,
    }
  })

  if (result.success) revalidatePath("/capital")
  return { ...result, values }
}
