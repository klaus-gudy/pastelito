"use client"

import { startTransition, useActionState, useState, useTransition } from "react"
import { PackageCheck, X } from "lucide-react"
import { toast } from "sonner"

import { DatePicker } from "@/components/date-picker"
import { MoneyInput } from "@/components/money-input"
import { PaymentMethodSelect } from "@/components/payment-method-select"
import { VerifyFirst } from "@/components/verify-first"
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  cancelPreorder,
  deliverPreorder,
  type SaleFormState,
} from "@/lib/actions/sales"

type Preorder = {
  id: string
  customer: string
  /** Pre-formatted unpaid amount, or null when paid in full. */
  balance: string | null
  /** Unpaid amount in whole shillings; pre-fills the amount collected. */
  balanceAmount: number
}

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

function DeliverForm({
  preorder,
  today,
  onDone,
}: {
  preorder: Preorder
  today: string
  onDone: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: SaleFormState, formData: FormData) => {
      const result = await deliverPreorder(previous, formData)
      if (result?.success) {
        toast.success(result.message)
        onDone()
      } else if (result?.message) {
        toast.error(result.message)
      }
      return result
    },
    undefined
  )
  const errors = state?.errors

  return (
    // onSubmit rather than `action` so React doesn't reset the form when the
    // server returns an error.
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        startTransition(() => action(formData))
      }}
    >
      <input type="hidden" name="saleId" value={preorder.id} />
      <FieldGroup>
        <Field data-invalid={!!errors?.date}>
          <FieldLabel htmlFor="delivery-date">Delivered on</FieldLabel>
          <DatePicker
            id="delivery-date"
            name="date"
            defaultValue={today}
            maxDate={today}
            invalid={!!errors?.date}
          />
          <FieldError errors={toErrors(errors?.date)} />
        </Field>
        {preorder.balance ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field data-invalid={!!errors?.amount}>
              <FieldLabel htmlFor="delivery-amount">Collected now</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>TZS</InputGroupText>
                </InputGroupAddon>
                <MoneyInput
                  id="delivery-amount"
                  name="amount"
                  defaultValue={String(preorder.balanceAmount)}
                  placeholder="Nothing"
                  aria-invalid={!!errors?.amount}
                />
              </InputGroup>
              <FieldDescription>
                {preorder.balance} is unpaid. Whatever isn&apos;t collected
                becomes their debt.
              </FieldDescription>
              <FieldError errors={toErrors(errors?.amount)} />
            </Field>
            <Field data-invalid={!!errors?.method}>
              <FieldLabel htmlFor="delivery-method">Paid by</FieldLabel>
              <PaymentMethodSelect
                id="delivery-method"
                invalid={!!errors?.method}
              />
              <FieldError errors={toErrors(errors?.method)} />
            </Field>
          </div>
        ) : (
          // Nothing to collect; the method is still required by the form.
          <input type="hidden" name="method" value="CASH" />
        )}
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Not yet
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Deliver"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Row buttons for a preorder: deliver it, or cancel it. */
export function PreorderActions({
  preorder,
  ready,
  verified,
  today,
}: {
  preorder: Preorder
  /** Stock on hand can fill it. */
  ready: boolean
  verified: boolean
  today: string
}) {
  const [delivering, setDelivering] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [pending, startCancel] = useTransition()

  return (
    <>
      <Button
        variant={ready ? "default" : "outline"}
        size="sm"
        onClick={() => setDelivering(true)}
      >
        <PackageCheck data-icon="inline-start" />
        Deliver
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Cancel preorder for ${preorder.customer}`}
        onClick={() => setCancelling(true)}
      >
        <X />
      </Button>

      <Dialog open={delivering} onOpenChange={setDelivering}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Deliver to {preorder.customer}</DialogTitle>
            <DialogDescription>
              Its items are taken off your stock and it moves to Sales, dated
              the day you deliver it.
            </DialogDescription>
          </DialogHeader>
          {verified ? (
            <DeliverForm
              preorder={preorder}
              today={today}
              onDone={() => setDelivering(false)}
            />
          ) : (
            <VerifyFirst action="deliver preorders" />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={cancelling}
        onOpenChange={(open) => !open && !pending && setCancelling(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel preorder for {preorder.customer}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              It is removed from your preorders. Any deposit is treated as
              refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                // Stay open until the server answers.
                event.preventDefault()
                startCancel(async () => {
                  const result = await cancelPreorder(preorder.id)
                  if (result?.success) {
                    toast.success(result.message)
                    setCancelling(false)
                  } else if (result?.message) {
                    toast.error(result.message)
                  }
                })
              }}
            >
              {pending ? "Saving…" : "Cancel preorder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
