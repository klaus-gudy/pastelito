"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"
import { z } from "zod"

import { signIn, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import { setFlash } from "@/lib/set-flash"
import { signInSchema, signUpSchema } from "@/lib/validations/auth"

export type AuthFormState =
  | {
      errors?: Partial<Record<"name" | "email" | "password", string[]>>
      message?: string
      values?: { name?: string; email?: string }
    }
  | undefined

const DEFAULT_REDIRECT = "/dashboard"

// Only allow same-site relative paths, so a crafted link can't send people
// to another site after they sign in.
function safeRedirect(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : ""
  return path.startsWith("/") && !path.startsWith("//")
    ? path
    : DEFAULT_REDIRECT
}

function formValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  }
}

export async function signUpWithCredentials(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const values = formValues(formData)
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const { name, email, password } = parsed.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return {
      errors: { email: ["An account with this email already exists."] },
      values,
    }
  }

  await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12) },
  })

  await signIn("credentials", { email, password, redirect: false })
  await setFlash({
    type: "success",
    message: "Account created. Welcome to Pastelito!",
  })
  redirect(DEFAULT_REDIRECT)
}

export async function signInWithCredentials(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const values = formValues(formData)
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values }
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false })
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: "Incorrect email or password.", values }
    }
    throw error
  }

  await setFlash({ type: "success", message: "Welcome back!" })
  redirect(safeRedirect(formData.get("callbackUrl")))
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", {
    redirectTo: safeRedirect(formData.get("callbackUrl")),
  })
}

export async function signOutUser() {
  await signOut({ redirect: false })
  await setFlash({ type: "info", message: "You've been signed out." })
  redirect("/sign-in")
}
