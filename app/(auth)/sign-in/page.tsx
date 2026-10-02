import type { Metadata } from "next"

import { googleEnabled } from "@/auth"
import { SignInForm } from "@/components/auth/sign-in-form"

export const metadata: Metadata = { title: "Sign in · Pastelito" }

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { callbackUrl, error } = await searchParams

  return (
    <SignInForm
      callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined}
      googleEnabled={googleEnabled}
      // Auth.js sends people back here with ?error= when a sign-in fails.
      error={error ? "We couldn't sign you in. Please try again." : undefined}
    />
  )
}
