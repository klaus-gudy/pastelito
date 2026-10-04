import { z } from "zod"

/** Whole shillings; commas typed for readability are ignored. */
const price = (label: string) =>
  z
    .string()
    .transform((value) => value.replace(/[,\s]/g, ""))
    .pipe(
      z
        .string()
        .min(1, { message: `Enter the ${label}.`, abort: true })
        .regex(/^\d{1,12}$/, {
          message: "Enter a whole number of shillings, like 45,000.",
          abort: true,
        })
        .refine((value) => Number(value) > 0, `Enter the ${label}.`)
    )

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter the product name.").max(100),
  sizeMl: z.coerce
    .number<string>({ message: "Enter the size in ml." })
    .int("Use a whole number of ml.")
    .min(1, "Enter the size in ml.")
    .max(10_000, "That size looks too large."),
  // What you usually pay a supplier; pre-fills purchases.
  buyingPrice: price("buying price"),
  sellingPrice: price("selling price"),
})

export type ProductInput = z.infer<typeof productSchema>
