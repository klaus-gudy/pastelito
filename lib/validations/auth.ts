import { z } from "zod"

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
})

// bcrypt only uses the first 72 bytes of a password.
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email,
  password: newPassword,
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  })
