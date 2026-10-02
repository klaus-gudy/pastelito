import type { Metadata } from "next"
import Link from "next/link"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { peekToken } from "@/lib/tokens"

export const metadata: Metadata = { title: "Choose a new password · Pastelito" }

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token } = await searchParams
  // Only checks the link; the token is used up when the form is submitted.
  const record =
    typeof token === "string" ? await peekToken("reset-password", token) : null

  if (!record || typeof token !== "string") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Link expired</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired. Reset links
            work once and last 1 hour.
          </CardDescription>
        </CardHeader>
        <CardFooter className="border-t py-4">
          <Button asChild className="w-full">
            <Link href="/forgot-password">Send a new link</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return <ResetPasswordForm token={token} email={record.email} />
}
