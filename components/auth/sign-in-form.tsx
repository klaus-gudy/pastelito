"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
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
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signInWithCredentials } from "@/lib/actions/auth"

export function SignInForm({
  callbackUrl,
  googleEnabled,
  error,
}: {
  callbackUrl?: string
  googleEnabled: boolean
  error?: string
}) {
  const [state, action, pending] = useActionState(
    signInWithCredentials,
    undefined
  )

  // Auth.js sends people back here with ?error= when a sign-in fails.
  useEffect(() => {
    if (error) toast.error(error, { id: "auth-error" })
  }, [error])

  useEffect(() => {
    if (state?.message) toast.error(state.message, { id: "auth-error" })
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your Pastelito account.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {googleEnabled && (
            <>
              <GoogleSignInButton callbackUrl={callbackUrl} />
              <FieldSeparator>or</FieldSeparator>
            </>
          )}
          <form action={action}>
            <FieldGroup>
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
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
              <Field data-invalid={!!state?.errors?.password}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!state?.errors?.password}
                  required
                />
                <FieldError
                  errors={state?.errors?.password?.map((message) => ({
                    message,
                  }))}
                />
              </Field>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </FieldGroup>
          </form>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-center border-t py-4 text-sm text-muted-foreground">
        New to Pastelito?&nbsp;
        <Link href="/sign-up" className="font-medium text-primary">
          Create an account
        </Link>
      </CardFooter>
    </Card>
  )
}
