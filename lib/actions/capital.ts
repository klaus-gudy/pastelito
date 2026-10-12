"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { capitalTotals } from "@/lib/capital"
import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { dayToDate } from "@/lib/dates"
import { withDbErrors } from "@/lib/db-errors"
import { formatMoney } from "@/lib/format"
import { Prisma } from "@/lib/generated/prisma/client"
import { LedgerError, serializable } from "@/lib/ledger"
import { prisma } from "@/lib/prisma"
import { businessSummary } from "@/lib/reports"
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
  return withDbErrors<CapitalFormState>(async () => {
    const user = await requireUser()
    const values = read(formData, ["name", "type", "amount", "method", "date"])

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
    if (!user.verified) return { message: VERIFY_TO_SAVE, values }

    const duplicate = await prisma.capitalSource.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
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
  })
}

export async function updateCapitalSource(
  _state: CapitalFormState,
  formData: FormData
): Promise<CapitalFormState> {
  return withDbErrors<CapitalFormState>(async () => {
    const user = await requireUser()
    const values = read(formData, ["id", "name", "type"])

    const parsed = capitalSourceSchema.safeParse(values)
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors, values }
    }
    if (!user.verified) return { message: VERIFY_TO_SAVE, values }

    const source = await prisma.capitalSource.findFirst({
      where: { id: values.id, userId: user.id, deletedAt: null },
      select: { id: true },
    })
    if (!source) {
      return { message: "That capital source no longer exists.", values }
    }

    const duplicate = await prisma.capitalSource.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
        id: { not: source.id },
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

    await prisma.capitalSource.update({
      where: { id: source.id },
      data: parsed.data,
    })

    revalidatePath("/capital")
    return { success: true, message: `${parsed.data.name} updated.` }
  })
}

export async function recordCapitalEntry(
  _state: CapitalFormState,
  formData: FormData
): Promise<CapitalFormState> {
  return withDbErrors<CapitalFormState>(async () => {
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
    if (!user.verified) return { message: VERIFY_TO_SAVE, values }

    // Serializable, so two repayments can't both spend the same cash or pay
    // off the same outstanding amount.
    const result = await serializable(async (tx) => {
      const source = await tx.capitalSource.findFirst({
        where: { id: values.sourceId, userId: user.id, deletedAt: null },
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
        // Repayments are paid from cash, so cash can never go below zero:
        // the most you can repay is the lower of what's owed and your cash.
        const { cash } = await businessSummary(user.id, tx)
        if (cash.lte(0)) {
          return { errors: { amount: ["You have no cash to repay with."] } }
        }
        if (cash.lt(outstanding) && cash.lt(parsed.data.amount)) {
          return {
            errors: {
              amount: [`You only have ${formatMoney(cash)} in cash.`],
            },
          }
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
    }).catch((error): NonNullable<CapitalFormState> => {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    })

    if (result.success) revalidatePath("/capital")
    return { ...result, values }
  })
}

/**
 * Corrects the amount, method, date or note of a recorded entry. The source
 * and type stay fixed, and the change must keep the source's outstanding
 * amount and the business's cash from going below zero.
 */
export async function updateCapitalEntry(
  _state: CapitalFormState,
  formData: FormData
): Promise<CapitalFormState> {
  return withDbErrors<CapitalFormState>(async () => {
    const user = await requireUser()
    const values = read(formData, ["id", "amount", "method", "date", "note"])

    const parsed = capitalEntrySchema.safeParse(values)
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors, values }
    }
    if (!user.verified) return { message: VERIFY_TO_SAVE, values }

    // Serializable, like recording, so a concurrent repayment can't spend
    // the same cash or outstanding amount this edit is checking.
    const result = await serializable(async (tx) => {
      const entry = await tx.capitalEntry.findFirst({
        where: { id: values.id, userId: user.id },
        include: { source: { select: { name: true } } },
      })
      if (!entry) return { message: "That entry no longer exists." }

      const amount = new Prisma.Decimal(parsed.data.amount)
      const totals = (await capitalTotals(user.id, tx)).get(entry.sourceId)
      const received = totals?.received ?? new Prisma.Decimal(0)
      const repaid = totals?.repaid ?? new Prisma.Decimal(0)

      if (entry.type === "RECEIVED") {
        // Can't have received less than has already been paid back.
        const least = repaid
        if (received.sub(entry.amount).add(amount).lt(least)) {
          return {
            errors: {
              amount: [
                `${entry.source.name} has already been repaid ${formatMoney(
                  repaid
                )}, so this can't be lower than ${formatMoney(
                  entry.amount.sub(received.sub(repaid))
                )}.`,
              ],
            },
          }
        }
      } else {
        const most = received.sub(repaid.sub(entry.amount))
        if (amount.gt(most)) {
          return {
            errors: { amount: [`At most ${formatMoney(most)} can be repaid.`] },
          }
        }
      }

      // Money in raises cash and money out lowers it; only a change that
      // lowers cash can push it below zero.
      const sign = entry.type === "RECEIVED" ? 1 : -1
      const effect = amount.sub(entry.amount).mul(sign)
      if (effect.lt(0)) {
        const { cash } = await businessSummary(user.id, tx)
        if (cash.add(effect).lt(0)) {
          return {
            errors: {
              amount: [
                `That would take your cash below zero. You have ${formatMoney(
                  cash
                )}.`,
              ],
            },
          }
        }
      }

      await tx.capitalEntry.update({
        where: { id: entry.id },
        data: {
          amount,
          method: parsed.data.method,
          date: dayToDate(parsed.data.date),
          note: parsed.data.note,
        },
      })
      return { success: true, message: `Entry for ${entry.source.name} updated.` }
    }).catch((error): NonNullable<CapitalFormState> => {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    })

    if (result.success) revalidatePath("/capital")
    return { ...result, values }
  })
}

export type DeleteCapitalEntryResult = { success?: boolean; message: string }

/**
 * Removes an entry recorded by mistake. Taking back money received is
 * refused once it was repaid or spent, so the source never owes less than
 * zero and cash never goes below zero.
 */
export async function deleteCapitalEntry(
  id: string
): Promise<DeleteCapitalEntryResult> {
  return withDbErrors<DeleteCapitalEntryResult>(async () => {
    const user = await requireUser()
    if (!user.verified) return { message: VERIFY_TO_SAVE }

    const result = await serializable(async (tx) => {
      const entry = await tx.capitalEntry.findFirst({
        where: { id, userId: user.id },
        include: { source: { select: { name: true } } },
      })
      if (!entry) return { message: "That entry no longer exists." }

      // A repayment only ever adds back cash and outstanding.
      if (entry.type === "RECEIVED") {
        const totals = (await capitalTotals(user.id, tx)).get(entry.sourceId)
        const outstanding = (totals?.received ?? new Prisma.Decimal(0)).sub(
          totals?.repaid ?? new Prisma.Decimal(0)
        )
        if (outstanding.lt(entry.amount)) {
          return {
            message: `${entry.source.name} has already been repaid, so this entry can't be deleted. Remove the repayment first.`,
          }
        }
        const { cash } = await businessSummary(user.id, tx)
        if (cash.lt(entry.amount)) {
          return {
            message: `This money has already been spent. Deleting it would take your cash below zero.`,
          }
        }
      }

      await tx.capitalEntry.delete({ where: { id: entry.id } })
      return { success: true, message: `Entry for ${entry.source.name} deleted.` }
    }).catch((error): DeleteCapitalEntryResult => {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    })

    if (result.success) revalidatePath("/capital")
    return result
  })
}
