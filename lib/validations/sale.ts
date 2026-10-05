import { z } from "zod"

import {
  amountField,
  dayField,
  noteField,
  paymentMethodField,
} from "@/lib/validations/common"

/** Like amountField, but blank means none (a sale without a discount). */
const optionalAmountField = z
  .string()
  .trim()
  .transform((value) => value.replace(/[,\s]/g, ""))
  .pipe(
    z.union([
      z.literal("").transform(() => null),
      z.string().pipe(amountField),
    ])
  )

export const saleItemSchema = z.object({
  productId: z.string().min(1, "Pick a product."),
  // Perfumes are sold under different brands; optional.
  brand: z
    .string()
    .trim()
    .max(100, "Keep the brand under 100 characters.")
    .transform((value) => value || null),
  quantity: z.coerce
    .number<string>({ message: "Enter the quantity." })
    .int("Use a whole number.")
    .min(1, "At least 1.")
    .max(100_000, "That quantity looks too large."),
  // Price per unit in whole shillings.
  unitPrice: amountField,
})

export const saleSchema = z.object({
  // Empty means a walk-in customer.
  customerId: z.string().transform((value) => value || null),
  date: dayField,
  discount: optionalAmountField,
  // Paid now; whatever is left becomes the customer's debt.
  amountPaid: optionalAmountField,
  method: paymentMethodField,
  note: noteField,
  items: z
    .array(saleItemSchema)
    .min(1, "Add at least one item.")
    .max(50, "Split very large sales into several."),
})
