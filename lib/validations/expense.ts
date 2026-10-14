import { z } from "zod"

import { expenseCategories, type ExpenseCategory } from "@/lib/labels"
import {
  amountField,
  dayField,
  noteField,
  paymentMethodField,
} from "@/lib/validations/common"

const categories = Object.keys(expenseCategories) as [
  ExpenseCategory,
  ...ExpenseCategory[],
]

export const expenseSchema = z.object({
  category: z.enum(categories, { message: "Pick what the money was for." }),
  amount: amountField,
  method: paymentMethodField,
  date: dayField,
  description: noteField,
})
