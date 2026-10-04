import { z } from "zod"

import {
  amountField,
  dayField,
  noteField,
  paymentMethodField,
} from "@/lib/validations/common"

export const purchaseItemSchema = z.object({
  productId: z.string().min(1, "Pick a product."),
  quantity: z.coerce
    .number<string>({ message: "Enter the quantity." })
    .int("Use a whole number.")
    .min(1, "At least 1.")
    .max(100_000, "That quantity looks too large."),
  // Cost per unit in whole shillings.
  unitCost: amountField,
})

export const purchaseSchema = z.object({
  // Typed or picked; matched to an existing supplier by name, or created.
  supplierName: z
    .string()
    .trim()
    .max(100, "Keep the supplier name under 100 characters.")
    .transform((value) => value || null),
  date: dayField,
  method: paymentMethodField,
  note: noteField,
  items: z
    .array(purchaseItemSchema)
    .min(1, "Add at least one item.")
    .max(50, "Split very large purchases into several.")
    .refine(
      (items) =>
        new Set(items.map((item) => item.productId)).size === items.length,
      "List each product once; increase its quantity instead."
    ),
})

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Enter the supplier's name.").max(100),
  phone: z
    .string()
    .trim()
    .max(30, "That phone number looks too long.")
    .transform((value) => value || null),
})
