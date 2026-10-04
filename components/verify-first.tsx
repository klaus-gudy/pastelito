"use client"

import { useActionState } from "react"
import { MailWarning } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DialogClose, DialogFooter } from "@/components/ui/dialog"
import { resendVerificationEmail } from "@/lib/actions/auth"

/** Shown in place of a dialog's form until the user's email is verified. */
export function VerifyFirst({ action }: { action: string }) {
  const [state, resend, pending] = useActionState(async () => {
    const result = await resendVerificationEmail()
    if (result?.sent) toast.success("Verification email sent.")
    else if (result?.message) toast.info(result.message)
    return result
  }, undefined)

  return (
    <div className="grid gap-6">
      <Alert>
        <MailWarning />
        <AlertTitle>Verify your email to {action}</AlertTitle>
        <AlertDescription>
          Open the link we emailed you, then come back to {action}.
        </AlertDescription>
      </Alert>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Close
          </Button>
        </DialogClose>
        <form action={resend}>
          <Button type="submit" disabled={pending || state?.sent}>
            {pending
              ? "Sending…"
              : state?.sent
                ? "Email sent"
                : "Resend verification email"}
          </Button>
        </form>
      </DialogFooter>
    </div>
  )
}
