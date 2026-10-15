"use client"

import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import { DatePicker } from "@/components/date-picker"
import { PaymentMethodSelect } from "@/components/payment-method-select"
import { VerifyFirst } from "@/components/verify-first"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { returnSaleItems, type SaleFormState } from "@/lib/actions/sales"
import { formatCount, formatMoney } from "@/lib/format"
import { returnTotals } from "@/lib/returns"

/** A completed sale, with what can still come back. Amounts in shillings. */
export type ReturnableSale = {
  id: string
  customer: string | null
  total: number
  /** The items' value before the sale's discount. */
  subtotal: number
  /** Paid so far, net of earlier refunds. */
  paid: number
  items: {
    key: string
    label: string
    brand: string | null
    quantity: number
    unitPrice: number
  }[]
}

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

function ReturnForm({
  sale,
  today,
  onSaved,
}: {
  sale: ReturnableSale
  today: string
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: SaleFormState, formData: FormData) => {
      const result = await returnSaleItems(previous, formData)
      if (result?.success) {
        toast.success(result.message)
        onSaved()
      } else if (result?.message) {
        toast.error(result.message)
      }
      return result
    },
    undefined
  )
  const errors = state?.errors
  const [counts, setCounts] = useState<Record<string, string>>({})

  const lines = sale.items.map((item) => {
    const count = Number(counts[item.key] || 0)
    const quantity =
      Number.isInteger(count) && count > 0 ? Math.min(count, item.quantity) : 0
    return { item, quantity }
  })
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const totals = returnTotals({
    total: sale.total,
    subtotal: sale.subtotal,
    paid: sale.paid,
    returnedValue: lines.reduce(
      (sum, { item, quantity }) => sum + item.unitPrice * quantity,
      0
    ),
    returnsEverything:
      units > 0 && lines.every(({ item, quantity }) => quantity === item.quantity),
  })

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
      <input type="hidden" name="saleId" value={sale.id} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          lines.map(({ item, quantity }) => ({ saleItemId: item.key, quantity }))
        )}
      />
      <FieldGroup>
        <Field data-invalid={!!errors?.items}>
          <FieldLabel>How many came back</FieldLabel>
          <ul className="divide-y rounded-lg border text-sm">
            {sale.items.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-4 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium" title={item.label}>
                    {item.label}
                  </div>
                  <div className="truncate text-muted-foreground tabular-nums">
                    {item.brand ? `${item.brand} · ` : ""}
                    {formatCount(item.quantity)} sold at{" "}
                    {formatMoney(item.unitPrice)}
                  </div>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={item.quantity}
                  step={1}
                  placeholder="0"
                  className="w-20 shrink-0 tabular-nums"
                  aria-label={`How many ${item.label} came back`}
                  value={counts[item.key] ?? ""}
                  onChange={(event) =>
                    setCounts((current) => ({
                      ...current,
                      [item.key]: event.target.value,
                    }))
                  }
                />
              </li>
            ))}
          </ul>
          <FieldError errors={toErrors(errors?.items)} />
        </Field>

        {units > 0 && (
          <dl className="grid gap-1 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Worth on the sale</dt>
              <dd className="tabular-nums">{formatMoney(totals.credit)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">New sale total</dt>
              <dd className="tabular-nums">{formatMoney(totals.newTotal)}</dd>
            </div>
            {totals.balanceAfter > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Still owed after</dt>
                <dd className="tabular-nums">
                  {formatMoney(totals.balanceAfter)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4 font-medium">
              <dt>Refund to the customer</dt>
              <dd className="tabular-nums">{formatMoney(totals.refund)}</dd>
            </div>
          </dl>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors?.method}>
            <FieldLabel htmlFor="return-method">Refunded by</FieldLabel>
            <PaymentMethodSelect
              id="return-method"
              invalid={!!errors?.method}
            />
            <FieldError errors={toErrors(errors?.method)} />
          </Field>
          <Field data-invalid={!!errors?.date}>
            <FieldLabel htmlFor="return-date">Date</FieldLabel>
            <DatePicker
              id="return-date"
              name="date"
              defaultValue={today}
              maxDate={today}
              invalid={!!errors?.date}
            />
            <FieldError errors={toErrors(errors?.date)} />
          </Field>
        </div>
        <Field data-invalid={!!errors?.note}>
          <FieldLabel htmlFor="return-note">Reason</FieldLabel>
          <Textarea
            id="return-note"
            name="note"
            placeholder="Optional, e.g. wrong scent"
            aria-invalid={!!errors?.note}
          />
          <FieldError errors={toErrors(errors?.note)} />
          <FieldDescription>
            Returned items go back into stock.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending || units === 0}>
          {pending
            ? "Saving…"
            : totals.refund > 0
              ? `Return and refund ${formatMoney(totals.refund)}`
              : "Return items"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Opened from a sale's details, so it has no trigger of its own. */
export function ReturnSaleDialog({
  sale,
  verified,
  today,
  open,
  onOpenChange,
}: {
  sale: ReturnableSale
  verified: boolean
  today: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Return items from {sale.customer ?? "a walk-in sale"}
          </DialogTitle>
          <DialogDescription>
            The sale is reduced by what comes back. Anything paid beyond the
            new total is refunded from your cash.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <ReturnForm
            sale={sale}
            today={today}
            onSaved={() => onOpenChange(false)}
          />
        ) : (
          <VerifyFirst action="record returns" />
        )}
      </DialogContent>
    </Dialog>
  )
}
