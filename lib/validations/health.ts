import { z } from "zod"

/** A whole number within [min, max]; blank means "use the default". */
const target = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/[%,\s]/g, "") || undefined)
    .pipe(
      z.coerce
        .number<string>({ message: "Enter a whole number." })
        .int("Use a whole number.")
        .min(min, `Use ${min} or more.`)
        .max(max, `Use ${max} or less.`)
        .optional()
    )
    .transform((value) => value ?? null)

export const healthTargetsSchema = z.object({
  marginPct: target(1, 100),
  collectionPct: target(1, 100),
  salesTrendPct: target(-100, 1000),
  stockMaxDays: target(1, 365),
  paybackPct: target(1, 1000),
  overdueDays: target(1, 365),
  repeatPct: target(1, 100),
  preorderMaxDays: target(1, 365),
})
