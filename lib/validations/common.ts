import { z } from "zod"

import { todayIso } from "@/lib/dates"

export const paymentMethods = [
  "CASH",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
  "CARD",
  "OTHER",
] as const

export const paymentMethodField = z.enum(paymentMethods, {
  message: "Pick how the money moved.",
})

/** Whole shillings; commas typed for readability are ignored. */
export const amountField = z
  .string()
  .transform((value) => value.replace(/[,\s]/g, ""))
  .pipe(
    z
      .string()
      // abort: each bad amount gets one message, not several.
      .min(1, { message: "Enter the amount.", abort: true })
      .regex(/^\d{1,12}$/, {
        message: "Enter a whole number of shillings, like 500,000.",
        abort: true,
      })
      .refine((value) => Number(value) > 0, "Enter the amount.")
  )

/** True for a real calendar day: rejects "2026-02-31" and "2026-13-01". */
function isCalendarDay(day: string) {
  const [year, month, date] = day.split("-").map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, date))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === date
  )
}

export const dayField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Pick a date.", abort: true })
  .refine(isCalendarDay, { message: "Pick a date.", abort: true })
  .refine((day) => day <= todayIso(), "The date can't be in the future.")

/** Optional: forms without a note field simply omit it. */
export const noteField = z
  .string()
  .trim()
  .max(500, "Keep the note under 500 characters.")
  .optional()
  .transform((value) => value || null)

/** Zod issues keyed by their dotted path, e.g. "items.0.quantity". */
export function issuesByPath(error: z.ZodError) {
  const errors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form"
    ;(errors[key] ??= []).push(issue.message)
  }
  return errors
}
