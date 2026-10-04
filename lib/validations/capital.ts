import { z } from "zod"

import {
  amountField,
  dayField,
  noteField,
  paymentMethodField,
} from "@/lib/validations/common"

export { amountField, dayField } from "@/lib/validations/common"

export const capitalEntrySchema = z.object({
  amount: amountField,
  method: paymentMethodField,
  date: dayField,
  note: noteField,
})

export const capitalSourceSchema = z.object({
  name: z.string().trim().min(1, "Enter who the money came from.").max(100),
  type: z.enum(["OWNER", "INVESTOR", "LOAN"], {
    message: "Pick the type of capital.",
  }),
})
