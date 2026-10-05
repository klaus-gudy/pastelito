"use client"

import { useState, useTransition } from "react"
import { PackageCheck, X } from "lucide-react"
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
import {
  cancelPreorder,
  deliverPreorder,
  type SaleFormState,
} from "@/lib/actions/sales"

type Step = "deliver" | "cancel"

/** Row buttons for a preorder: deliver it, or cancel it. Both confirm first. */
export function PreorderActions({
  saleId,
  customer,
  balance,
}: {
  saleId: string
  customer: string
  /** Pre-formatted unpaid amount, or null when paid in full. */
  balance: string | null
}) {
  const [step, setStep] = useState<Step | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (action: (id: string) => Promise<SaleFormState>) =>
    startTransition(async () => {
      const result = await action(saleId)
      if (result?.success) {
        toast.success(result.message)
        setStep(null)
      } else if (result?.message) {
        toast.error(result.message)
      }
    })

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setStep("deliver")}>
        <PackageCheck data-icon="inline-start" />
        Deliver
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Cancel preorder for ${customer}`}
        onClick={() => setStep("cancel")}
      >
        <X />
      </Button>

      <AlertDialog
        open={step !== null}
        onOpenChange={(open) => !open && !pending && setStep(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {step === "cancel"
                ? `Cancel preorder for ${customer}?`
                : `Deliver preorder to ${customer}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {step === "cancel"
                ? "It is removed from your preorders. Any deposit is treated as refunded."
                : `Its items are taken off your stock and it moves to Sales.${
                    balance ? ` The ${balance} still unpaid becomes their debt.` : ""
                  }`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {step === "cancel" ? "Keep it" : "Not yet"}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={step === "cancel" ? "destructive" : "default"}
              disabled={pending}
              onClick={(event) => {
                // Stay open until the server answers.
                event.preventDefault()
                run(step === "cancel" ? cancelPreorder : deliverPreorder)
              }}
            >
              {pending
                ? "Saving…"
                : step === "cancel"
                  ? "Cancel preorder"
                  : "Deliver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
