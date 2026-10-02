"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { MailCheck } from "lucide-react"
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { requestPasswordReset } from "@/lib/actions/auth"

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    undefined
  )

  useEffect(() => {
    if (state?.sent) toast.success("Check your email for a reset link.")
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          {state?.sent
            ? "If an account exists for that email, we've sent a link to reset your password. It expires in 1 hour."
            : "Enter your email and we'll send you a link to choose a new password."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.sent ? (
          <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3 text-sm">
            <MailCheck className="size-4 shrink-0 text-primary" />
            <span className="truncate">{state.values?.email}</span>
          </div>
        ) : (
          <form action={action}>
            <FieldGroup>
              <Field data-invalid={!!state?.errors?.email}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={state?.values?.email}
                  aria-invalid={!!state?.errors?.email}
                  required
                />
                <FieldError
                  errors={state?.errors?.email?.map((message) => ({ message }))}
                />
              </Field>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Sending…" : "Send reset link"}
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center border-t py-4 text-sm text-muted-foreground">
        Remembered it?&nbsp;
        <Link href="/sign-in" className="font-medium text-primary">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
