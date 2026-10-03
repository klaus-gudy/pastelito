import { z } from "zod"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter the product name.").max(100),
  brand: optionalText(100),
  sizeMl: z.coerce
    .number<string>({ message: "Enter the size in ml." })
    .int("Use a whole number of ml.")
    .min(1, "Enter the size in ml.")
    .max(10_000, "That size looks too large."),
  sku: optionalText(50),
  // Kept as a string so the Decimal column gets the exact value.
  sellingPrice: z
    .string()
    .trim()
    .transform((value) => value.replace(/,/g, ""))
    .pipe(
      z
        .string()
        .min(1, "Enter the selling price.")
        .regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a price like 45000 or 45000.50.")
    ),
})

export type ProductInput = z.infer<typeof productSchema>
