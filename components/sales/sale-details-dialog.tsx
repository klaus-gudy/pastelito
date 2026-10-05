"use client"

import { startTransition, useActionState, useState } from "react"
import { Eye, Plus } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { recordSalePayment, type SaleFormState } from "@/lib/actions/sales"
import { formatCount } from "@/lib/format"

export type SaleDetails = {
  id: string
  date: string
  customer: string | null
  note: string | null
  subtotal: string
  discount: string | null
  total: string
  paid: string
  balance: string | null
  /** Unpaid amount in whole shillings; fills "Pay balance". */
  balanceAmount: number
  items: {
    key: string
    label: string
    brand: string | null
    quantity: number
    unitPrice: string
    lineTotal: string
  }[]
  payments: { key: string; date: string; method: string; amount: string }[]
}

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

function PaymentForm({
  sale,
  today,
  onDone,
}: {
  sale: SaleDetails
  today: string
  onDone: () => void
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
  const [amount, setAmount] = useState("")

  return (
    // onSubmit rather than `action` so React doesn't reset the form when the
    // server returns an error.
    <form
      className="grid gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        startTransition(() => action(formData))
      }}
    >
      <input type="hidden" name="saleId" value={sale.id} />
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
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
              value={amount}
              onValueChange={setAmount}
              required
            />
          </InputGroup>
          <FieldError errors={toErrors(errors?.amount)} />
        </Field>
        <Field>
          {/* Invisible label keeps the button level with the input. */}
          <FieldLabel aria-hidden className="invisible max-sm:hidden">
            Pay balance
          </FieldLabel>
          {/* Field stretches its children; the wrapper keeps the button its
              natural width. */}
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAmount(String(sale.balanceAmount))}
            >
              Pay balance
            </Button>
          </div>
        </Field>
      </div>
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

export function SaleDetailsDialog({
  sale,
  verified,
  today,
}: {
  sale: SaleDetails
  verified: boolean
  today: string
}) {
  const [recording, setRecording] = useState(false)

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setRecording(false)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye data-icon="inline-start" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Sale to {sale.customer ?? "walk-in customer"}</DialogTitle>
          <DialogDescription>{sale.date}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit price</TableHead>
                <TableHead className="pr-4">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item) => (
                <TableRow key={item.key}>
                  <TableCell className="pl-4 font-medium">
                    {item.label}
                    {item.brand && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {item.brand}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="tabular-nums">{item.unitPrice}</TableCell>
                  <TableCell className="pr-4 tabular-nums">
                    {item.lineTotal}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              {sale.discount && (
                <>
                  <TableRow>
                    <TableCell className="pl-4" colSpan={3}>
                      Subtotal
                    </TableCell>
                    <TableCell className="pr-4 tabular-nums">
                      {sale.subtotal}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-4" colSpan={3}>
                      Discount
                    </TableCell>
                    <TableCell className="pr-4 tabular-nums">
                      −{sale.discount}
                    </TableCell>
                  </TableRow>
                </>
              )}
              <TableRow>
                <TableCell className="pl-4" colSpan={3}>
                  Total
                </TableCell>
                <TableCell className="pr-4 tabular-nums">{sale.total}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Payments</h3>
          {sale.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing paid yet.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {sale.payments.map((payment) => (
                <li key={payment.key} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {payment.date} · {payment.method}
                  </span>
                  <span className="tabular-nums">{payment.amount}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="flex justify-between gap-4 border-t pt-2 text-sm font-medium">
            <span>{sale.balance ? "Still owed" : "Paid in full"}</span>
            <span className="tabular-nums">{sale.balance ?? sale.paid}</span>
          </p>
          {sale.balance &&
            (recording ? (
              verified ? (
                <PaymentForm
                  sale={sale}
                  today={today}
                  onDone={() => setRecording(false)}
                />
              ) : (
                <VerifyFirst action="record payments" />
              )
            ) : (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRecording(true)}
                >
                  <Plus data-icon="inline-start" />
                  Record payment
                </Button>
              </div>
            ))}
        </div>

        {sale.note && (
          <p className="text-sm text-muted-foreground">{sale.note}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
