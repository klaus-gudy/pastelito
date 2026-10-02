"use client"

import Link from "next/link"
import { useActionState } from "react"

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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signUpWithCredentials } from "@/lib/actions/auth"

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, action, pending] = useActionState(
    signUpWithCredentials,
    undefined
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Start tracking your sales in a minute.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {googleEnabled && (
            <>
              <GoogleSignInButton />
              <FieldSeparator>or</FieldSeparator>
            </>
          )}
          <form action={action}>
            <FieldGroup>
              <Field data-invalid={!!state?.errors?.name}>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  defaultValue={state?.values?.name}
                  aria-invalid={!!state?.errors?.name}
                  required
                />
                <FieldError
                  errors={state?.errors?.name?.map((message) => ({ message }))}
                />
              </Field>
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
                <FieldLabel htmlFor="password">Password</FieldLabel>
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
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Creating account…" : "Create account"}
              </Button>
            </FieldGroup>
          </form>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-center border-t py-4 text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link href="/sign-in" className="font-medium text-primary">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  )
}
