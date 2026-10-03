import { z } from "zod"

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter the product name.").max(100),
  sizeMl: z.coerce
    .number<string>({ message: "Enter the size in ml." })
    .int("Use a whole number of ml.")
    .min(1, "Enter the size in ml.")
    .max(10_000, "That size looks too large."),
  // Whole shillings; commas typed for readability are ignored.
  sellingPrice: z
    .string()
    .transform((value) => value.replace(/[,\s]/g, ""))
    .pipe(
      z
        .string()
        .min(1, "Enter the selling price.")
        .regex(/^\d{1,12}$/, "Enter a whole number of shillings, like 45,000.")
        .refine((value) => Number(value) > 0, "Enter the selling price.")
    ),
})

export type ProductInput = z.infer<typeof productSchema>
