import { z } from "zod"

import {
  stockAdjustmentReasons,
  type StockAdjustmentReason,
} from "@/lib/labels"
import { noteField } from "@/lib/validations/common"

const reasons = Object.keys(stockAdjustmentReasons) as [
  StockAdjustmentReason,
  ...StockAdjustmentReason[],
]

export const stockAdjustmentSchema = z
  .object({
    productId: z.string().min(1, "Pick a product."),
    direction: z.enum(["out", "in"], {
      message: "Pick whether stock goes out or comes in.",
    }),
    quantity: z.coerce
      .number<string>({ message: "Enter the quantity." })
      .int("Use a whole number.")
      .min(1, "At least 1.")
      .max(100_000, "That quantity looks too large."),
    reason: z.enum(reasons, { message: "Pick a reason." }),
    note: noteField,
  })
  .refine(
    ({ direction, reason }) => {
      const allowed = stockAdjustmentReasons[reason].direction
      return allowed === "both" || allowed === direction
    },
    {
      path: ["reason"],
      message: "That reason doesn't fit this direction.",
    }
  )
