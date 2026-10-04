import { z } from "zod"

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name.").max(100),
  // Spaces and dashes are dropped so the same number always matches.
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, "") || null)
    .pipe(
      z
        .string()
        .regex(/^\+?\d{7,15}$/, "Enter a phone number like 0712 345 678.")
        .nullable()
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value || null)
    .pipe(z.email("Enter a valid email address.").nullable()),
})
