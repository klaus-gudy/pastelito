"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { DatePicker } from "@/components/date-picker"
import { MoneyInput } from "@/components/money-input"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createSale, type SaleFormState } from "@/lib/actions/sales"
import { formatCount, formatMoney } from "@/lib/format"

export type SaleProductOption = {
  id: string
  label: string
  /** Default selling price in whole shillings; pre-fills the unit price. */
  price: number
  stock: number
}

export type CustomerOption = { id: string; name: string }

type Row = {
  key: number
  productId: string
  brand: string
  quantity: string
  unitPrice: string
}

const WALK_IN = "walk-in"

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

const lineTotal = (row: Row) =>
  (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0)

function SaleForm({
  products,
  customers,
  today,
  onSaved,
}: {
  products: SaleProductOption[]
  customers: CustomerOption[]
  today: string
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: SaleFormState, formData: FormData) => {
      const result = await createSale(previous, formData)
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

  const emptyRow = { productId: "", brand: "", quantity: "1", unitPrice: "" }
  // Row keys only need to be unique; the counter is read in event handlers.
  const nextKey = useRef(1)
  const [rows, setRows] = useState<Row[]>([{ key: 0, ...emptyRow }])
  const [customerId, setCustomerId] = useState(WALK_IN)
  const [discount, setDiscount] = useState("")
  const [amountPaid, setAmountPaid] = useState("")

  const updateRow = (key: number, change: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row))
    )

  const subtotal = rows.reduce((sum, row) => sum + lineTotal(row), 0)
  const total = subtotal - (Number(discount) || 0)
  const balance = total - (Number(amountPaid) || 0)
  const productById = (id: string) => products.find((p) => p.id === id)

  return (
    // Submitted via onSubmit rather than `action` so React doesn't reset the
    // form (and every row) when the server returns an error.
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        formData.set("customerId", customerId === WALK_IN ? "" : customerId)
        formData.set("discount", discount)
        formData.set("amountPaid", amountPaid)
        formData.set(
          "items",
          JSON.stringify(
            rows.map(({ productId, brand, quantity, unitPrice }) => ({
              productId,
              brand,
              quantity,
              unitPrice,
            }))
          )
        )
        startTransition(() => action(formData))
      }}
    >
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors?.customerId}>
            <FieldLabel htmlFor="customerId">Customer</FieldLabel>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="customerId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WALK_IN}>Walk-in customer</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={toErrors(errors?.customerId)} />
          </Field>
          <Field data-invalid={!!errors?.date}>
            <FieldLabel htmlFor="date">Date</FieldLabel>
            <DatePicker
              id="date"
              name="date"
              defaultValue={today}
              maxDate={today}
              invalid={!!errors?.date}
            />
            <FieldError errors={toErrors(errors?.date)} />
          </Field>
        </div>

        <FieldSet data-invalid={!!errors?.items}>
          <FieldLegend variant="label">Items</FieldLegend>
          <div className="grid gap-3">
            <div className="hidden grid-cols-[minmax(0,1fr)_8rem_5rem_9rem_7rem_2rem] gap-2 text-xs text-muted-foreground sm:grid">
              <span>Product</span>
              <span>Brand</span>
              <span>Qty</span>
              <span>Unit price</span>
              <span>Line total</span>
            </div>
            {rows.map((row, index) => {
              const rowErrors = [
                ...(errors?.[`items.${index}.productId`] ?? []),
                ...(errors?.[`items.${index}.brand`] ?? []),
                ...(errors?.[`items.${index}.quantity`] ?? []),
                ...(errors?.[`items.${index}.unitPrice`] ?? []),
              ]
              const stock = productById(row.productId)?.stock
              return (
                <div key={row.key} className="grid gap-1">
                  <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_5rem_9rem_7rem_2rem] sm:items-center">
                    <Select
                      value={row.productId}
                      onValueChange={(productId) => {
                        const product = productById(productId)
                        // The price belongs to the product: switching product
                        // brings its selling price (editable).
                        updateRow(row.key, {
                          productId,
                          ...(product ? { unitPrice: String(product.price) } : {}),
                        })
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`Item ${index + 1} product`}
                        aria-invalid={!!errors?.[`items.${index}.productId`]}
                      >
                        <SelectValue placeholder="Pick a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem
                            key={product.id}
                            value={product.id}
                            disabled={product.stock === 0}
                          >
                            {product.label} ({formatCount(product.stock)} left)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={stock}
                      step={1}
                      aria-label={`Item ${index + 1} quantity`}
                      aria-invalid={!!errors?.[`items.${index}.quantity`]}
                      value={row.quantity}
                      className="sm:order-3"
                      onChange={(event) =>
                        updateRow(row.key, { quantity: event.target.value })
                      }
                    />
                    <Input
                      aria-label={`Item ${index + 1} brand`}
                      aria-invalid={!!errors?.[`items.${index}.brand`]}
                      placeholder="Brand (optional)"
                      autoComplete="off"
                      value={row.brand}
                      className="col-span-2 sm:order-2 sm:col-span-1"
                      onChange={(event) =>
                        updateRow(row.key, { brand: event.target.value })
                      }
                    />
                    <InputGroup className="col-span-2 sm:order-4 sm:col-span-1">
                      <InputGroupAddon>
                        <InputGroupText>TZS</InputGroupText>
                      </InputGroupAddon>
                      <MoneyInput
                        aria-label={`Item ${index + 1} unit price`}
                        aria-invalid={!!errors?.[`items.${index}.unitPrice`]}
                        placeholder="45,000"
                        value={row.unitPrice}
                        onValueChange={(unitPrice) =>
                          updateRow(row.key, { unitPrice })
                        }
                      />
                    </InputGroup>
                    <span className="text-sm tabular-nums sm:order-5">
                      {/* Column headings are hidden on phones. */}
                      <span className="text-muted-foreground sm:hidden">
                        Line total{" "}
                      </span>
                      {formatMoney(lineTotal(row))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove item ${index + 1}`}
                      className="justify-self-end sm:order-6 sm:justify-self-auto"
                      disabled={rows.length === 1}
                      onClick={() =>
                        setRows((current) =>
                          current.filter((other) => other.key !== row.key)
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <FieldError errors={toErrors(rowErrors)} />
                </div>
              )
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => {
                const key = nextKey.current++
                setRows((current) => [...current, { key, ...emptyRow }])
              }}
            >
              <Plus data-icon="inline-start" />
              Add item
            </Button>
            <FieldError errors={toErrors(errors?.items)} />
          </div>
        </FieldSet>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors?.discount}>
            <FieldLabel htmlFor="discount">Discount</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>TZS</InputGroupText>
              </InputGroupAddon>
              <MoneyInput
                id="discount"
                placeholder="Optional"
                aria-invalid={!!errors?.discount}
                value={discount}
                onValueChange={setDiscount}
              />
            </InputGroup>
            <FieldError errors={toErrors(errors?.discount)} />
          </Field>
          <div className="grid content-end gap-1 text-sm sm:text-right">
            <p>
              Total{" "}
              <span className="font-semibold tabular-nums">
                {formatMoney(Math.max(total, 0))}
              </span>
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors?.amountPaid}>
            <FieldLabel htmlFor="amountPaid">Paid now</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>TZS</InputGroupText>
              </InputGroupAddon>
              <MoneyInput
                id="amountPaid"
                placeholder="Leave empty if unpaid"
                aria-invalid={!!errors?.amountPaid}
                value={amountPaid}
                onValueChange={setAmountPaid}
              />
            </InputGroup>
            {total > 0 && (
              <button
                type="button"
                className="justify-self-start text-xs text-muted-foreground underline underline-offset-4"
                onClick={() => setAmountPaid(String(total))}
              >
                Paid in full
              </button>
            )}
            <FieldError errors={toErrors(errors?.amountPaid)} />
          </Field>
          <Field data-invalid={!!errors?.method}>
            <FieldLabel htmlFor="method">Paid by</FieldLabel>
            <PaymentMethodSelect id="method" invalid={!!errors?.method} />
            <FieldError errors={toErrors(errors?.method)} />
          </Field>
        </div>
        {total > 0 && (
          <p className="text-sm text-muted-foreground">
            {balance > 0
              ? `${formatMoney(balance)} will stay as a debt${customerId === WALK_IN ? " (walk-in)" : ""}.`
              : balance < 0
                ? "Payment is more than the total."
                : "Paid in full."}
          </p>
        )}

        <Field data-invalid={!!errors?.note}>
          <FieldLabel htmlFor="note">Note</FieldLabel>
          <Textarea
            id="note"
            name="note"
            placeholder="Optional"
            aria-invalid={!!errors?.note}
          />
          <FieldError errors={toErrors(errors?.note)} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record sale"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function NewSaleDialog({
  products,
  customers,
  verified,
  today,
}: {
  products: SaleProductOption[]
  customers: CustomerOption[]
  verified: boolean
  today: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          New sale
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>New sale</DialogTitle>
          <DialogDescription>
            What you sold. Stock is taken off your products as soon as you
            record it, and anything unpaid is kept as the customer&apos;s debt.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <SaleForm
            products={products}
            customers={customers}
            today={today}
            onSaved={() => setOpen(false)}
          />
        ) : (
          <VerifyFirst action="record sales" />
        )}
      </DialogContent>
    </Dialog>
  )
}
