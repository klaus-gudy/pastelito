"use client"

import { startTransition, useActionState, useState } from "react"
import { HandCoins } from "lucide-react"
import { toast } from "sonner"

import { DatePicker } from "@/components/date-picker"
import { MoneyInput } from "@/components/money-input"
import { PaymentMethodSelect } from "@/components/payment-method-select"
import { VerifyFirst } from "@/components/verify-first"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import { recordSalePayment, type SaleFormState } from "@/lib/actions/sales"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

export type PaymentSale = {
  id: string
  /** Pre-formatted, e.g. "TZS 20,000". */
  balance: string | null
  /** Unpaid amount in whole shillings; shown as the amount placeholder. */
  balanceAmount: number
}

/** Records an installment against a sale's balance. */
export function PaymentForm({
  sale,
  today,
  onDone,
  className,
}: {
  sale: PaymentSale
  today: string
  onDone: () => void
  className?: string
}) {
  const [state, action, pending] = useActionState(
    async (previous: SaleFormState, formData: FormData) => {
      const result = await recordSalePayment(previous, formData)
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
      className={cn("grid gap-4", className)}
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        startTransition(() => action(formData))
      }}
    >
      <input type="hidden" name="saleId" value={sale.id} />
      <Field data-invalid={!!errors?.amount}>
        <FieldLabel htmlFor="payment-amount">Amount</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText>TZS</InputGroupText>
          </InputGroupAddon>
          <MoneyInput
            id="payment-amount"
            name="amount"
            placeholder={formatCount(sale.balanceAmount)}
            aria-invalid={!!errors?.amount}
            required
          />
        </InputGroup>
        <FieldError errors={toErrors(errors?.amount)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors?.method}>
          <FieldLabel htmlFor="payment-method">Paid by</FieldLabel>
          <PaymentMethodSelect
            id="payment-method"
            invalid={!!errors?.method}
          />
          <FieldError errors={toErrors(errors?.method)} />
        </Field>
        <Field data-invalid={!!errors?.date}>
          <FieldLabel htmlFor="payment-date">Date</FieldLabel>
          <DatePicker
            id="payment-date"
            name="date"
            defaultValue={today}
            maxDate={today}
            invalid={!!errors?.date}
          />
          <FieldError errors={toErrors(errors?.date)} />
        </Field>
      </div>
      <Field data-invalid={!!errors?.note}>
        <FieldLabel htmlFor="payment-note">Note</FieldLabel>
        <Textarea
          id="payment-note"
          name="note"
          placeholder="Optional"
          aria-invalid={!!errors?.note}
        />
        <FieldError errors={toErrors(errors?.note)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save payment"}
        </Button>
      </div>
    </form>
  )
}

export function RecordPaymentDialog({
  sale,
  customer,
  verified,
  today,
}: {
  sale: PaymentSale
  customer: string | null
  verified: boolean
  today: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HandCoins data-icon="inline-start" />
          Pay
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {customer ?? "Walk-in customer"} still owes {sale.balance}.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <PaymentForm
            sale={sale}
            today={today}
            onDone={() => setOpen(false)}
          />
        ) : (
          <VerifyFirst action="record payments" />
        )}
      </DialogContent>
    </Dialog>
  )
}
