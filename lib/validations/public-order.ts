import { z } from "zod"

import { saleItemSchema } from "@/lib/validations/sale"
import { customerSchema } from "@/lib/validations/customer"
import { noteField } from "@/lib/validations/common"

/**
 * A preorder sent from the public order page. Prices aren't taken from the
 * form: each item is charged its product's selling price.
 */
export const publicOrderSchema = z.object({
  name: customerSchema.shape.name,
  // Required here: it is how the shop reaches the customer.
  phone: customerSchema.shape.phone.refine((phone) => phone !== null, {
    message: "Enter your phone number.",
  }),
  note: noteField,
  items: z
    .array(saleItemSchema.omit({ unitPrice: true }))
    .min(1, "Add at least one item.")
    .max(20, "That's a lot of items. Split it into several orders."),
})
