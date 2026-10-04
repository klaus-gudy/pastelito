import { z } from "zod"

import { todayIso } from "@/lib/dates"

const paymentMethods = [
  "CASH",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
  "CARD",
  "OTHER",
] as const

/** Whole shillings; commas typed for readability are ignored. */
export const amountField = z
  .string()
  .transform((value) => value.replace(/[,\s]/g, ""))
  .pipe(
    z
      .string()
      .min(1, "Enter the amount.")
      .regex(/^\d{1,12}$/, "Enter a whole number of shillings, like 500,000.")
      .refine((value) => Number(value) > 0, "Enter the amount.")
  )

export const dayField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
  .refine((day) => day <= todayIso(), "The date can't be in the future.")

const noteField = z
  .string()
  .trim()
  .max(500, "Keep the note under 500 characters.")
  .transform((value) => value || null)

export const capitalEntrySchema = z.object({
  amount: amountField,
  method: z.enum(paymentMethods, { message: "Pick how the money moved." }),
  date: dayField,
  note: noteField,
})

export const capitalSourceSchema = z.object({
  name: z.string().trim().min(1, "Enter who the money came from.").max(100),
  type: z.enum(["OWNER", "INVESTOR", "LOAN"], {
    message: "Pick the type of capital.",
  }),
})
