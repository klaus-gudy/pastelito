"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import { ChevronDown, CirclePlus, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { DatePicker } from "@/components/date-picker"
import { MoneyInput } from "@/components/money-input"
import { PaymentMethodSelect } from "@/components/payment-method-select"
import { VerifyFirst } from "@/components/verify-first"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
  FieldDescription,
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
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { addCustomerByName } from "@/lib/actions/customers"
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

/** Fields inside the payment section; an error in one opens it. */
const PAYMENT_FIELDS = ["discount", "amountPaid", "method", "note"]

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
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [state, action, pending] = useActionState(
    async (previous: SaleFormState, formData: FormData) => {
      const result = await createSale(previous, formData)
      if (result?.success) {
        toast.success(result.message)
        onSaved()
        return result
      }
      if (result?.message) toast.error(result.message)
      else if (result?.errors) {
        toast.error("Some details are missing. Check the fields marked in red.")
      }
      if (PAYMENT_FIELDS.some((field) => result?.errors?.[field])) {
        setPaymentOpen(true)
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
  const [customerList, setCustomerList] = useState(customers)
  const [customer, setCustomer] = useState<CustomerOption | null>(null)
  const [customerQuery, setCustomerQuery] = useState("")
  const [customerOpen, setCustomerOpen] = useState(false)
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [discount, setDiscount] = useState("")
  const [amountPaid, setAmountPaid] = useState("")

  const updateRow = (key: number, change: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row))
    )

  // Closed payment details mean "unpaid, no discount": nothing inside counts.
  const paidNow = paymentOpen ? amountPaid : ""
  const discountNow = paymentOpen ? discount : ""
  const subtotal = rows.reduce((sum, row) => sum + lineTotal(row), 0)
  const total = subtotal - (Number(discountNow) || 0)
  const productById = (id: string) => products.find((p) => p.id === id)

  // Stock isn't taken until the sale is saved, but the form shows what each
  // product would have left after the quantities already on it.
  const quantityOnForm = (productId: string, exceptKey?: number) =>
    rows.reduce(
      (sum, row) =>
        row.productId === productId && row.key !== exceptKey
          ? sum + (Number(row.quantity) || 0)
          : sum,
      0
    )
  const stockLeft = (product: SaleProductOption) =>
    Math.max(product.stock - quantityOnForm(product.id), 0)

  const newCustomerName = customerQuery.trim()
  // Offer to save the typed name unless it is already a customer.
  const canAddCustomer =
    newCustomerName.length > 0 &&
    !customerList.some(
      (other) => other.name.toLowerCase() === newCustomerName.toLowerCase()
    )
  const noCustomerMatches = !customerList.some((other) =>
    other.name.toLowerCase().includes(newCustomerName.toLowerCase())
  )

  const addCustomer = async () => {
    if (!canAddCustomer || addingCustomer) return
    setAddingCustomer(true)
    const result = await addCustomerByName(newCustomerName)
    setAddingCustomer(false)
    if (!result.customer) {
      toast.error(result.message ?? "Couldn't save the customer.")
      return
    }
    setCustomerList((current) =>
      [...current, result.customer!].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    )
    setCustomer(result.customer)
    setCustomerOpen(false)
    toast.success(`${result.customer.name} added to your customers.`)
  }

  return (
    // Submitted via onSubmit rather than `action` so React doesn't reset the
    // form (and every row) when the server returns an error.
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        formData.set("customerId", customer?.id ?? "")
        formData.set("discount", discountNow)
        formData.set("amountPaid", paidNow)
        // The method picker only exists while the section is open.
        if (!formData.has("method")) formData.set("method", "CASH")
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
            <Combobox
              items={customerList}
              value={customer}
              onValueChange={setCustomer}
              itemToStringLabel={(item: CustomerOption) => item.name}
              isItemEqualToValue={(item, value) => item.id === value.id}
              open={customerOpen}
              onOpenChange={setCustomerOpen}
              onInputValueChange={setCustomerQuery}
            >
              <ComboboxInput
                id="customerId"
                placeholder="Optional"
                showTrigger={customerList.length > 0}
                showClear={!!customer}
                className="w-full"
                aria-invalid={!!errors?.customerId}
                onKeyDown={(event) => {
                  // Enter on a name that matches no one saves it instead of
                  // submitting the sale.
                  if (event.key === "Enter" && canAddCustomer && noCustomerMatches) {
                    event.preventDefault()
                    addCustomer()
                  }
                }}
              />
              <ComboboxContent>
                <ComboboxEmpty>
                  {newCustomerName ? "No customer by that name" : "No customers yet"}
                </ComboboxEmpty>
                <ComboboxList>
                  {(item: CustomerOption) => (
                    <ComboboxItem key={item.id} value={item}>
                      {item.name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
                {canAddCustomer && (
                  <div className="border-t p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      disabled={addingCustomer}
                      // Keep focus in the input so the popup stays open.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={addCustomer}
                    >
                      <CirclePlus data-icon="inline-start" />
                      <span className="truncate">
                        {addingCustomer ? "Adding" : "Add"} “{newCustomerName}”
                      </span>
                      {addingCustomer && <Spinner />}
                    </Button>
                  </div>
                )}
              </ComboboxContent>
            </Combobox>
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
              // The most this row can take: stock minus the other rows.
              const product = productById(row.productId)
              const maxQuantity = product
                ? product.stock - quantityOnForm(product.id, row.key)
                : undefined
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
                      {/* Popper keeps the list under its field; item-aligned
                          jumps to the top when nothing is picked yet. */}
                      <SelectContent
                        position="popper"
                        className="min-w-(--radix-select-trigger-width)"
                      >
                        {products.map((option) => (
                          <SelectItem
                            key={option.id}
                            value={option.id}
                            disabled={
                              option.id !== row.productId &&
                              stockLeft(option) === 0
                            }
                          >
                            {option.label} ({formatCount(stockLeft(option))}{" "}
                            left)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={maxQuantity}
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
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
                  {formatMoney(Math.max(total, 0))}
                </span>
              </p>
            </div>
            <FieldError errors={toErrors(errors?.items)} />
          </div>
        </FieldSet>

        {/* Closed means "not paid yet": nothing inside is sent. */}
        <Collapsible
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          className="group/details"
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground"
            >
              <ChevronDown
                data-icon="inline-start"
                className="transition-transform group-data-[state=open]/details:rotate-180"
              />
              Add payment (optional)
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <FieldGroup className="pt-4">
              <FieldDescription>
                Record a discount and what the customer paid now. Anything
                left unpaid is kept as their debt.
              </FieldDescription>
              {/* Two equal columns. Left: discount over paid amount. Right:
                  a shortcut to fill the paid amount, at the top. */}
              <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
                <Field
                  data-invalid={!!errors?.discount}
                  className="sm:col-start-1"
                >
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
                <Field
                  data-invalid={!!errors?.amountPaid}
                  className="sm:col-start-1"
                >
                  <FieldLabel htmlFor="amountPaid">Paid amount</FieldLabel>
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
                  <FieldError errors={toErrors(errors?.amountPaid)} />
                </Field>
                <Field className="sm:col-start-2 sm:row-start-1">
                  {/* Invisible label keeps the button level with the inputs. */}
                  <FieldLabel aria-hidden className="invisible max-sm:hidden">
                    Paid in full
                  </FieldLabel>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    disabled={total <= 0}
                    onClick={() => setAmountPaid(String(total))}
                  >
                    Paid in full
                  </Button>
                </Field>
              </div>
              {/* How it was paid, and anything worth remembering. */}
              <div className="grid gap-6">
                <Field data-invalid={!!errors?.method}>
                  <FieldLabel htmlFor="method">Payment method</FieldLabel>
                  <PaymentMethodSelect id="method" invalid={!!errors?.method} />
                  <FieldError errors={toErrors(errors?.method)} />
                </Field>
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
              </div>
            </FieldGroup>
          </CollapsibleContent>
        </Collapsible>

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
