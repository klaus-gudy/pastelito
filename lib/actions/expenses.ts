"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { dayToDate } from "@/lib/dates"
import { withDbErrors } from "@/lib/db-errors"
import { formatMoney } from "@/lib/format"
import { Prisma } from "@/lib/generated/prisma/client"
import { expenseCategoryLabel } from "@/lib/labels"
import { LedgerError, serializable } from "@/lib/ledger"
import { prisma } from "@/lib/prisma"
import { businessSummary } from "@/lib/reports"
import { expenseSchema } from "@/lib/validations/expense"

export type ExpenseFormState =
  | {
      errors?: Partial<Record<string, string[]>>
      values?: Record<string, string>
      success?: boolean
      message?: string
    }
  | undefined

const fields = ["category", "amount", "method", "date", "description"] as const

const read = (formData: FormData, names: readonly string[]) =>
  Object.fromEntries(
    names.map((name) => [name, String(formData.get(name) ?? "")])
  )

/** Why spending `amount` more is refused, or null when cash covers it. */
function cashShortfall(cash: Prisma.Decimal, amount: Prisma.Decimal) {
  if (amount.lte(cash)) return null
  return cash.gt(0)
    ? `You only have ${formatMoney(cash)} in cash.`
    : "You have no cash to pay with. Add capital first."
}

export async function createExpense(
  _state: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  return withDbErrors<ExpenseFormState>(async () => {
    const user = await requireUser()
    const values = read(formData, fields)

    const parsed = expenseSchema.safeParse(values)
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors, values }
    }
    if (!user.verified) return { message: VERIFY_TO_SAVE, values }

    // Expenses are paid from cash, so cash can never go below zero.
    // Serializable, so two expenses can't both spend the same cash.
    const result = await serializable(async (tx) => {
      const amount = new Prisma.Decimal(parsed.data.amount)
      const { cash } = await businessSummary(user.id, tx)
      const shortfall = cashShortfall(cash, amount)
      if (shortfall) return { errors: { amount: [shortfall] } }

      await tx.expense.create({
        data: {
          userId: user.id,
          category: parsed.data.category,
          amount,
          method: parsed.data.method,
          date: dayToDate(parsed.data.date),
          description: parsed.data.description,
        },
      })
      return {
        success: true,
        message: `${expenseCategoryLabel(parsed.data.category)} expense of ${formatMoney(amount)} recorded.`,
      }
    }).catch((error): NonNullable<ExpenseFormState> => {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    })

    if (result.success) revalidatePath("/expenses")
    return { ...result, values }
  })
}

/** Corrects an expense. Raising it must not take cash below zero. */
export async function updateExpense(
  _state: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  return withDbErrors<ExpenseFormState>(async () => {
    const user = await requireUser()
    const values = read(formData, ["id", ...fields])

    const parsed = expenseSchema.safeParse(values)
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors, values }
    }
    if (!user.verified) return { message: VERIFY_TO_SAVE, values }

    const result = await serializable(async (tx) => {
      const expense = await tx.expense.findFirst({
        where: { id: values.id, userId: user.id },
      })
      if (!expense) return { message: "That expense no longer exists." }

      const amount = new Prisma.Decimal(parsed.data.amount)
      // Only spending more than before can push cash below zero.
      const extra = amount.sub(expense.amount)
      if (extra.gt(0)) {
        const { cash } = await businessSummary(user.id, tx)
        if (extra.gt(cash)) {
          return {
            errors: {
              amount: [
                `That would take your cash below zero. You have ${formatMoney(cash)}, so this can be at most ${formatMoney(expense.amount.add(Prisma.Decimal.max(cash, 0)))}.`,
              ],
            },
          }
        }
      }

      await tx.expense.update({
        where: { id: expense.id },
        data: {
          category: parsed.data.category,
          amount,
          method: parsed.data.method,
          date: dayToDate(parsed.data.date),
          description: parsed.data.description,
        },
      })
      return { success: true, message: "Expense updated." }
    }).catch((error): NonNullable<ExpenseFormState> => {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    })

    if (result.success) revalidatePath("/expenses")
    return { ...result, values }
  })
}

export type DeleteExpenseResult = { success?: boolean; message: string }

/** Removes an expense recorded by mistake; its money returns to cash. */
export async function deleteExpense(id: string): Promise<DeleteExpenseResult> {
  return withDbErrors<DeleteExpenseResult>(async () => {
    const user = await requireUser()
    if (!user.verified) return { message: VERIFY_TO_SAVE }

    const expense = await prisma.expense.findFirst({
      where: { id, userId: user.id },
      select: { id: true, category: true, amount: true },
    })
    if (!expense) return { message: "That expense no longer exists." }

    await prisma.expense.delete({ where: { id: expense.id } })
    revalidatePath("/expenses")
    return {
      success: true,
      message: `${expenseCategoryLabel(expense.category)} expense of ${formatMoney(expense.amount)} deleted.`,
    }
  })
}
