"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import Link from "next/link"
import { ClipboardList, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react"
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
import { formatCount, formatMoney } from "@/lib/format"

export type ProductOption = {
  id: string
  label: string
  /** Buying price (or average cost) in whole shillings; pre-fills unit cost. */
  defaultCost: number | null
}

/** Units to buy so waiting preorders can be delivered. */
export type PreorderNeed = { productId: string; quantity: number }

type Row = { key: number; productId: string; quantity: string; unitCost: string }

const emptyRow = { productId: "", quantity: "1", unitCost: "" }

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

const supplierEdits = new Set(["input-change", "item-press", "clear-press"])

const lineTotal = (row: Row) =>
  (Number(row.quantity) || 0) * (Number(row.unitCost) || 0)

/**
 * Rows with every preorder need added: products already on the form are
 * raised to the quantity needed, the rest get new rows from `firstKey` on.
 * Blank rows are dropped.
 */
function withPreorderNeeds(
  rows: Row[],
  needs: PreorderNeed[],
  products: ProductOption[],
  firstKey: number
) {
  const kept = rows
    .filter((row) => row.productId)
    .map((row) => {
      const need = needs.find((n) => n.productId === row.productId)
      return need && (Number(row.quantity) || 0) < need.quantity
        ? { ...row, quantity: String(need.quantity) }
        : row
    })
  const added = needs
    .filter((need) => !kept.some((row) => row.productId === need.productId))
    .map((need, index) => {
      const cost = products.find((p) => p.id === need.productId)?.defaultCost
      return {
        key: firstKey + index,
        productId: need.productId,
        quantity: String(need.quantity),
        unitCost: cost ? String(cost) : "",
      }
    })
  return [...kept, ...added]
}

function PurchaseForm({
  products,
  suppliers,
  availableCash,
  preorderNeeds,
  today,
  onSaved,
}: {
  products: ProductOption[]
  suppliers: string[]
  availableCash: number
  preorderNeeds: PreorderNeed[]
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

  // Row keys only need to be unique; the counter is read in event handlers.
  const nextKey = useRef(1)
  const [rows, setRows] = useState<Row[]>([{ key: 0, ...emptyRow }])
  const [supplier, setSupplier] = useState("")
  // Costs come from the product's buying price; one row at a time can be
  // opened to change its cost, e.g. when the supplier's price changed.
  const [editingKey, setEditingKey] = useState<number | null>(null)

  const updateRow = (key: number, change: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row))
    )

  const total = rows.reduce((sum, row) => sum + lineTotal(row), 0)
  // A cost stays editable while it has an error, or while a picked product
  // has no buying price to fill it with.
  const costEditable = (row: Row, index: number) =>
    editingKey === row.key ||
    !!errors?.[`items.${index}.unitCost`] ||
    (!!row.productId && !row.unitCost)
  // The cost column only shows while some row's cost is being edited.
  const showCostColumn = rows.some(costEditable)
  const columns = showCostColumn
    ? "sm:grid-cols-[minmax(0,1fr)_5rem_9rem_7rem_4.5rem]"
    : "sm:grid-cols-[minmax(0,1fr)_5rem_7rem_4.5rem]"
  // Purchases are paid from cash; cash can't go below zero.
  const tooExpensive = total > 0 && total > availableCash
  const neededFor = (productId: string) =>
    preorderNeeds.find((need) => need.productId === productId)?.quantity ?? 0
  // Needs not yet covered by the rows on the form.
  const uncovered = preorderNeeds.filter(
    (need) =>
      !rows.some(
        (row) =>
          row.productId === need.productId &&
          (Number(row.quantity) || 0) >= need.quantity
      )
  )
  const addPreorderItems = () => {
    const firstKey = nextKey.current
    nextKey.current += preorderNeeds.length
    const next = withPreorderNeeds(rows, preorderNeeds, products, firstKey)
    setRows(next.length > 0 ? next : [{ key: nextKey.current++, ...emptyRow }])
  }

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

        {uncovered.length > 0 && (
          <Alert>
            <ClipboardList />
            <AlertTitle>Preorders are waiting</AlertTitle>
            <AlertDescription className="grid gap-3">
              <p>
                {uncovered.length === 1
                  ? "1 product is"
                  : `${uncovered.length} products are`}{" "}
                short for the preorders you&apos;ve taken.
              </p>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPreorderItems}
                >
                  <Plus data-icon="inline-start" />
                  Add preorder items
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <FieldSet data-invalid={!!errors?.items}>
          <FieldLegend variant="label">Items</FieldLegend>
          <div className="grid gap-3">
            <div
              className={`hidden gap-2 text-xs text-muted-foreground sm:grid ${columns}`}
            >
              <span>Product</span>
              <span>Qty</span>
              {showCostColumn && <span>Unit cost</span>}
              <span>Line total</span>
            </div>
            {rows.map((row, index) => {
              const rowErrors = [
                ...(errors?.[`items.${index}.productId`] ?? []),
                ...(errors?.[`items.${index}.quantity`] ?? []),
                ...(errors?.[`items.${index}.unitCost`] ?? []),
              ]
              const editable = costEditable(row, index)
              return (
                <div key={row.key} className="grid gap-1">
                  <div
                    className={`grid grid-cols-[minmax(0,1fr)_5rem] gap-2 sm:items-center ${columns}`}
                  >
                    <Select
                      value={row.productId}
                      onValueChange={(productId) => {
                        const defaultCost = products.find(
                          (p) => p.id === productId
                        )?.defaultCost
                        // The cost belongs to the product: switching product
                        // brings its buying price (editable). Without one, a
                        // previous product's cost is cleared, but a cost typed
                        // before any product was picked is kept.
                        updateRow(row.key, {
                          productId,
                          ...(defaultCost
                            ? { unitCost: String(defaultCost) }
                            : row.productId
                              ? { unitCost: "" }
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
                            {neededFor(product.id) > 0 &&
                              ` (${formatCount(neededFor(product.id))} for preorders)`}
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
                    {editable ? (
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
                    ) : (
                      showCostColumn && (
                        // Read-only while another row's cost is edited.
                        <span className="col-span-2 text-sm text-muted-foreground tabular-nums sm:col-span-1">
                          <span className="sm:hidden">Unit cost </span>
                          {row.unitCost ? formatMoney(Number(row.unitCost)) : "—"}
                        </span>
                      )
                    )}
                    <span className="text-sm tabular-nums">
                      {/* Column headings are hidden on phones. */}
                      <span className="text-muted-foreground sm:hidden">
                        Line total{" "}
                      </span>
                      {formatMoney(lineTotal(row))}
                    </span>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit item ${index + 1} cost`}
                        aria-pressed={editable}
                        disabled={!row.productId}
                        onClick={() =>
                          setEditingKey((current) =>
                            current === row.key ? null : row.key
                          )
                        }
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove item ${index + 1}`}
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

        {(tooExpensive || availableCash <= 0) && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>
              {availableCash <= 0
                ? "No cash to buy with"
                : "More than your available cash"}
            </AlertTitle>
            <AlertDescription>
              <p>
                {availableCash <= 0
                  ? "Record capital before buying stock."
                  : `You have ${formatMoney(availableCash)}; this purchase costs ${formatMoney(total)}. Lower it or add capital first.`}
              </p>
              <Link href="/capital" className="underline underline-offset-4">
                Go to capital
              </Link>
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
        <Button
          type="submit"
          disabled={pending || tooExpensive || availableCash <= 0}
        >
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
  preorderNeeds,
  verified,
  today,
}: {
  products: ProductOption[]
  suppliers: string[]
  availableCash: number
  preorderNeeds: PreorderNeed[]
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
            preorderNeeds={preorderNeeds}
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
