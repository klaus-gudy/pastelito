"use client"

import { useActionState, useEffect } from "react"
import { MailWarning } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { resendVerificationEmail } from "@/lib/actions/auth"

export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState(
    resendVerificationEmail,
    undefined
  )

  useEffect(() => {
    if (state?.sent) toast.success(`Verification email sent to ${email}.`)
    else if (state?.message) toast.info(state.message)
  }, [state, email])

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <MailWarning className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Please verify your email. We sent a link to{" "}
          <span className="font-medium">{email}</span>.
        </span>
      </p>
      <form action={action}>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Resend email"}
        </Button>
      </form>
    </div>
  )
}
