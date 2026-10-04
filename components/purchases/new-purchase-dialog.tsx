"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import { Plus, Trash2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { DatePicker } from "@/components/date-picker"
import { MoneyInput } from "@/components/money-input"
import { PaymentMethodSelect } from "@/components/payment-method-select"
import { VerifyFirst } from "@/components/verify-first"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
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
import {
  createPurchase,
  type PurchaseFormState,
} from "@/lib/actions/purchases"
import { formatMoney } from "@/lib/format"

export type ProductOption = {
  id: string
  label: string
  /** Last average cost in whole shillings, used to pre-fill the unit cost. */
  lastCost: number | null
}

type Row = { key: number; productId: string; quantity: string; unitCost: string }

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

const supplierEdits = new Set(["input-change", "item-press", "clear-press"])

const lineTotal = (row: Row) =>
  (Number(row.quantity) || 0) * (Number(row.unitCost) || 0)

function PurchaseForm({
  products,
  suppliers,
  availableCash,
  today,
  onSaved,
}: {
  products: ProductOption[]
  suppliers: string[]
  availableCash: number
  today: string
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: PurchaseFormState, formData: FormData) => {
      const result = await createPurchase(previous, formData)
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

  const emptyRow = { productId: "", quantity: "1", unitCost: "" }
  // Row keys only need to be unique; the counter is read in event handlers.
  const nextKey = useRef(1)
  const [rows, setRows] = useState<Row[]>([{ key: 0, ...emptyRow }])
  const [supplier, setSupplier] = useState("")

  const updateRow = (key: number, change: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row))
    )

  const total = rows.reduce((sum, row) => sum + lineTotal(row), 0)
  const cashAfter = availableCash - total

  return (
    // Submitted via onSubmit rather than `action` so React doesn't reset the
    // form (and every row) when the server returns an error.
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        formData.set("supplierName", supplier)
        formData.set(
          "items",
          JSON.stringify(
            rows.map(({ productId, quantity, unitCost }) => ({
              productId,
              quantity,
              unitCost,
            }))
          )
        )
        startTransition(() => action(formData))
      }}
    >
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-3">
          <Field data-invalid={!!errors?.supplierName}>
            <FieldLabel htmlFor="supplierName">Supplier</FieldLabel>
            <Combobox
              items={suppliers}
              inputValue={supplier}
              onInputValueChange={(text, { reason }) => {
                // Base UI resets unmatched text when focus leaves the input;
                // a new supplier name is allowed, so only accept user edits.
                if (supplierEdits.has(reason)) setSupplier(text)
              }}
            >
              <ComboboxInput
                id="supplierName"
                placeholder="Optional"
                showTrigger={suppliers.length > 0}
                className="w-full"
              />
              <ComboboxContent>
                <ComboboxEmpty>
                  {supplier.trim()
                    ? `New supplier: “${supplier.trim()}”`
                    : "Type a supplier name"}
                </ComboboxEmpty>
                <ComboboxList>
                  {(name: string) => (
                    <ComboboxItem key={name} value={name}>
                      {name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <FieldError errors={toErrors(errors?.supplierName)} />
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
          <Field data-invalid={!!errors?.method}>
            <FieldLabel htmlFor="method">Paid by</FieldLabel>
            <PaymentMethodSelect id="method" invalid={!!errors?.method} />
            <FieldError errors={toErrors(errors?.method)} />
          </Field>
        </div>

        <FieldSet data-invalid={!!errors?.items}>
          <FieldLegend variant="label">Items</FieldLegend>
          <div className="grid gap-3">
            <div className="hidden grid-cols-[minmax(0,1fr)_5rem_9rem_7rem_2rem] gap-2 text-xs text-muted-foreground sm:grid">
              <span>Product</span>
              <span>Qty</span>
              <span>Unit cost</span>
              <span>Line total</span>
            </div>
            {rows.map((row, index) => {
              const rowErrors = [
                ...(errors?.[`items.${index}.productId`] ?? []),
                ...(errors?.[`items.${index}.quantity`] ?? []),
                ...(errors?.[`items.${index}.unitCost`] ?? []),
              ]
              return (
                <div key={row.key} className="grid gap-1">
                  <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_9rem_7rem_2rem] sm:items-center">
                    <Select
                      value={row.productId}
                      onValueChange={(productId) => {
                        const lastCost = products.find(
                          (p) => p.id === productId
                        )?.lastCost
                        updateRow(row.key, {
                          productId,
                          ...(!row.unitCost && lastCost
                            ? { unitCost: String(lastCost) }
                            : {}),
                        })
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`Item ${index + 1} product`}
                        aria-invalid={
                          !!errors?.[`items.${index}.productId`]
                        }
                      >
                        <SelectValue placeholder="Pick a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem
                            key={product.id}
                            value={product.id}
                            disabled={rows.some(
                              (other) =>
                                other.key !== row.key &&
                                other.productId === product.id
                            )}
                          >
                            {product.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      aria-label={`Item ${index + 1} quantity`}
                      aria-invalid={!!errors?.[`items.${index}.quantity`]}
                      value={row.quantity}
                      onChange={(event) =>
                        updateRow(row.key, { quantity: event.target.value })
                      }
                    />
                    <InputGroup className="col-span-2 sm:col-span-1">
                      <InputGroupAddon>
                        <InputGroupText>TZS</InputGroupText>
                      </InputGroupAddon>
                      <MoneyInput
                        aria-label={`Item ${index + 1} unit cost`}
                        aria-invalid={!!errors?.[`items.${index}.unitCost`]}
                        placeholder="25,000"
                        value={row.unitCost}
                        onValueChange={(unitCost) =>
                          updateRow(row.key, { unitCost })
                        }
                      />
                    </InputGroup>
                    <span className="text-sm tabular-nums">
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
                      className="justify-self-end sm:justify-self-auto"
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={rows.length >= products.length}
                onClick={() => {
                  const key = nextKey.current++
                  setRows((current) => [...current, { key, ...emptyRow }])
                }}
              >
                <Plus data-icon="inline-start" />
                Add item
              </Button>
              <p className="text-sm">
                Total{" "}
                <span className="font-semibold tabular-nums">
                  {formatMoney(total)}
                </span>
              </p>
            </div>
            <FieldError errors={toErrors(errors?.items)} />
          </div>
        </FieldSet>

        {total > 0 && cashAfter < 0 && (
          <Alert>
            <TriangleAlert />
            <AlertTitle>More than your available cash</AlertTitle>
            <AlertDescription>
              Your available cash is {formatMoney(availableCash)}; this
              purchase would leave {formatMoney(cashAfter)}. You can still
              record it.
            </AlertDescription>
          </Alert>
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
          {pending ? "Saving…" : "Record purchase"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function NewPurchaseDialog({
  products,
  suppliers,
  availableCash,
  verified,
  today,
}: {
  products: ProductOption[]
  suppliers: string[]
  availableCash: number
  verified: boolean
  today: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          New purchase
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New purchase</DialogTitle>
          <DialogDescription>
            Stock you bought. It&apos;s added to your products as soon as you
            record it.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <PurchaseForm
            products={products}
            suppliers={suppliers}
            availableCash={availableCash}
            today={today}
            onSaved={() => setOpen(false)}
          />
        ) : (
          <VerifyFirst action="record purchases" />
        )}
      </DialogContent>
    </Dialog>
  )
}
