import type { Metadata } from "next"

import { googleEnabled } from "@/auth"
import { SignUpForm } from "@/components/auth/sign-up-form"

export const metadata: Metadata = { title: "Create account · Pastelito" }

export default function SignUpPage() {
  return <SignUpForm googleEnabled={googleEnabled} />
}
