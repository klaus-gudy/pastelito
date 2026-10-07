"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"
import { z } from "zod"

import { auth, signIn, signOut } from "@/auth"
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/auth-emails"
import { isDbUnavailable, withDbErrors } from "@/lib/db-errors"
import { prisma } from "@/lib/prisma"
import { setFlash } from "@/lib/set-flash"
import { consumeToken } from "@/lib/tokens"
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validations/auth"

export type AuthFormState =
  | {
      errors?: Partial<
        Record<"name" | "email" | "password" | "confirmPassword", string[]>
      >
      message?: string
      values?: { name?: string; email?: string }
      /** Set once a reset link has been requested. */
      sent?: boolean
    }
  | undefined

const DEFAULT_REDIRECT = "/"

const SAME_SITE = "http://same.site"

// Only allow same-site relative paths, so a crafted link can't send people
// to another site after they sign in. Paths are resolved the way a browser
// would, which catches tricks like "/\evil.com" or "/<tab>/evil.com".
function safeRedirect(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : ""
  if (!path.startsWith("/")) return DEFAULT_REDIRECT
  try {
    const url = new URL(path, SAME_SITE)
    if (url.origin === SAME_SITE) return url.pathname + url.search + url.hash
  } catch {}
  return DEFAULT_REDIRECT
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
  return withDbErrors<AuthFormState>(async () => {
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

    // A failed email shouldn't block sign-up; the app shows a resend banner.
    await sendVerificationEmail(email).catch((error) =>
      console.error("[email] verification email failed", error)
    )

    await signIn("credentials", { email, password, redirect: false })
    await setFlash({
      type: "success",
      message: "Account created. Check your email to verify your address.",
    })
    redirect(DEFAULT_REDIRECT)
  })
}

export async function signInWithCredentials(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  return withDbErrors<AuthFormState>(async () => {
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
      // A database outage also arrives as an AuthError; let withDbErrors
      // report it rather than blaming the password.
      if (error instanceof AuthError && !isDbUnavailable(error)) {
        return { message: "Incorrect email or password.", values }
      }
      throw error
    }

    await setFlash({ type: "success", message: "Welcome back!" })
    redirect(safeRedirect(formData.get("callbackUrl")))
  })
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", {
    redirectTo: safeRedirect(formData.get("callbackUrl")),
  })
}

export async function requestPasswordReset(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  return withDbErrors<AuthFormState>(async () => {
    const values = formValues(formData)
    const parsed = forgotPasswordSchema.safeParse({
      email: formData.get("email"),
    })
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors, values }
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    })
    if (user) {
      await sendPasswordResetEmail(parsed.data.email).catch((error) =>
        console.error("[email] password reset email failed", error)
      )
    }

    // Same answer whether or not the account exists, so this form can't be
    // used to find out who has an account.
    return { sent: true, values }
  })
}

export async function resetPassword(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  return withDbErrors<AuthFormState>(async () => {
    const parsed = resetPasswordSchema.safeParse({
      token: formData.get("token"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    })
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors }
    }

    const email = await consumeToken("reset-password", parsed.data.token)
    const user = email
      ? await prisma.user.findUnique({ where: { email } })
      : null
    if (!user) {
      return { message: "This reset link is invalid or has expired." }
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(parsed.data.password, 12),
          // Opening the emailed link proves they own the address.
          emailVerified: user.emailVerified ?? new Date(),
        },
      }),
      // Sign out every device, in case someone else had access.
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ])

    await setFlash({
      type: "success",
      message: "Password updated. Sign in with your new password.",
    })
    redirect("/sign-in")
  })
}

export async function resendVerificationEmail(): Promise<AuthFormState> {
  return withDbErrors<AuthFormState>(async () => {
    const session = await auth()
    if (!session?.user?.id) redirect("/sign-in")

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, emailVerified: true },
    })
    if (!user) redirect("/sign-in")
    if (user.emailVerified) {
      return { message: "Your email is already verified." }
    }

    const sent = await sendVerificationEmail(user.email)
    return sent
      ? { sent: true }
      : { message: "Please wait a minute before requesting another email." }
  })
}

export async function signOutUser() {
  await signOut({ redirect: false })
  await setFlash({ type: "info", message: "You've been signed out." })
  redirect("/sign-in")
}
