"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { deleteCapitalEntry } from "@/lib/actions/capital"

/** A Delete button for one history row, with its confirmation. */
export function DeleteEntryButton({
  id,
  sourceName,
  /** Pre-formatted, e.g. "TZS 500,000". */
  amount,
  type,
  verified,
}: {
  id: string
  sourceName: string
  amount: string
  type: "RECEIVED" | "REPAID"
  verified: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const what =
    type === "REPAID"
      ? `repayment of ${amount} to ${sourceName}`
      : `${amount} received from ${sourceName}`

  return (
    <>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={`Delete ${what}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 />
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => !next && !pending && setOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {verified
                ? `The ${what} is removed from your records and your balances change. This can't be undone.`
                : "Verify your email first to delete capital entries."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep</AlertDialogCancel>
            {verified && (
              <AlertDialogAction
                variant="destructive"
                disabled={pending}
                onClick={(event) => {
                  // Stay open until the server answers.
                  event.preventDefault()
                  startTransition(async () => {
                    const result = await deleteCapitalEntry(id)
                    if (result.success) toast.success(result.message)
                    else toast.error(result.message)
                    setOpen(false)
                  })
                }}
              >
                {pending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
