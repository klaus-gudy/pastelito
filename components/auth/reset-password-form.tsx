"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { resetPassword } from "@/lib/actions/auth"

export function ResetPasswordForm({
  token,
  email,
}: {
  token: string
  email: string
}) {
  const [state, action, pending] = useActionState(resetPassword, undefined)

  useEffect(() => {
    if (state?.message) toast.error(state.message, { id: "reset-error" })
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>
          For {email}. You&apos;ll be signed out everywhere else.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action}>
          <FieldGroup>
            <input type="hidden" name="token" value={token} />
            {/* Helps password managers save the new password for the right account. */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={email}
              readOnly
              tabIndex={-1}
              aria-hidden
              className="sr-only"
            />
            <Field data-invalid={!!state?.errors?.password}>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!state?.errors?.password}
                required
              />
              {state?.errors?.password ? (
                <FieldError
                  errors={state.errors.password.map((message) => ({
                    message,
                  }))}
                />
              ) : (
                <FieldDescription>At least 8 characters.</FieldDescription>
              )}
            </Field>
            <Field data-invalid={!!state?.errors?.confirmPassword}>
              <FieldLabel htmlFor="confirmPassword">
                Confirm new password
              </FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!state?.errors?.confirmPassword}
                required
              />
              <FieldError
                errors={state?.errors?.confirmPassword?.map((message) => ({
                  message,
                }))}
              />
            </Field>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Updating…" : "Update password"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t py-4 text-sm text-muted-foreground">
        <Link href="/sign-in" className="font-medium text-primary">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
