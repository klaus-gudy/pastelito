"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import { CircleCheck, Plus, Trash2 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  submitPublicOrder,
  type PublicOrderFormState,
} from "@/lib/actions/public-order"
import { formatMoney } from "@/lib/format"

export type OrderProductOption = {
  id: string
  label: string
  /** Selling price in whole shillings. */
  price: number
}

type Row = { key: number; productId: string; brand: string; quantity: string }

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

export function PublicOrderForm({
  shopSlug,
  products,
}: {
  shopSlug: string
  products: OrderProductOption[]
}) {
  const [state, action, pending] = useActionState(
    (previous: PublicOrderFormState, formData: FormData) =>
      submitPublicOrder(previous, formData),
    undefined
  )
  const errors = state?.errors

  const emptyRow = { productId: "", brand: "", quantity: "1" }
  // Row keys only need to be unique; the counter is read in event handlers.
  const nextKey = useRef(1)
  const [rows, setRows] = useState<Row[]>([{ key: 0, ...emptyRow }])
  const updateRow = (key: number, change: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row))
    )

  const priceOf = (id: string) => products.find((p) => p.id === id)?.price ?? 0
  const total = rows.reduce(
    (sum, row) => sum + priceOf(row.productId) * (Number(row.quantity) || 0),
    0
  )

  if (state?.success) {
    return (
      <Alert>
        <CircleCheck />
        <AlertTitle>Thank you!</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    // Submitted via onSubmit so React doesn't reset the rows on an error.
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        formData.set("shop", shopSlug)
        formData.set(
          "items",
          JSON.stringify(
            rows.map(({ productId, brand, quantity }) => ({
              productId,
              brand,
              quantity,
            }))
          )
        )
        startTransition(() => action(formData))
      }}
    >
      {state?.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <Field data-invalid={!!errors?.name}>
          <FieldLabel htmlFor="name">Your name</FieldLabel>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            maxLength={100}
            aria-invalid={!!errors?.name}
          />
          <FieldError errors={toErrors(errors?.name)} />
        </Field>
        <Field data-invalid={!!errors?.phone}>
          <FieldLabel htmlFor="phone">Phone number</FieldLabel>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="0712 345 678"
            required
            aria-invalid={!!errors?.phone}
          />
          <FieldError errors={toErrors(errors?.phone)} />
        </Field>

        <FieldSet data-invalid={!!errors?.items}>
          <FieldLegend variant="label">What would you like?</FieldLegend>
          <div className="grid gap-4">
            {rows.map((row, index) => {
              const rowErrors = [
                ...(errors?.[`items.${index}.productId`] ?? []),
                ...(errors?.[`items.${index}.brand`] ?? []),
                ...(errors?.[`items.${index}.quantity`] ?? []),
              ]
              return (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-lg border p-3 sm:border-0 sm:p-0"
                >
                  {/* One line from sm up; on phones the perfume gets its own
                      line above the brand and quantity. */}
                  <div className="grid grid-cols-[minmax(0,1fr)_5rem_auto] gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_5rem_auto]">
                    <NativeSelect
                      className="col-span-3 w-full sm:col-span-1"
                      value={row.productId}
                      aria-label={`Item ${index + 1} product`}
                      aria-invalid={!!errors?.[`items.${index}.productId`]}
                      onChange={(event) =>
                        updateRow(row.key, { productId: event.target.value })
                      }
                    >
                      <NativeSelectOption value="" disabled>
                        Pick a perfume
                      </NativeSelectOption>
                      {products.map((product) => (
                        <NativeSelectOption key={product.id} value={product.id}>
                          {product.label} · {formatMoney(product.price)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <Input
                      value={row.brand}
                      placeholder="Brand or scent (optional)"
                      maxLength={100}
                      aria-label={`Item ${index + 1} brand`}
                      onChange={(event) =>
                        updateRow(row.key, { brand: event.target.value })
                      }
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      value={row.quantity}
                      aria-label={`Item ${index + 1} quantity`}
                      aria-invalid={!!errors?.[`items.${index}.quantity`]}
                      onChange={(event) =>
                        updateRow(row.key, { quantity: event.target.value })
                      }
                    />
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
                  <FieldError errors={toErrors(rowErrors)} />
                </div>
              )
            })}
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              disabled={rows.length >= 20}
              onClick={() =>
                setRows((current) => [
                  ...current,
                  { key: nextKey.current++, ...emptyRow },
                ])
              }
            >
              <Plus data-icon="inline-start" />
              Add another
            </Button>
          </div>
          <FieldError errors={toErrors(errors?.items)} />
        </FieldSet>

        <Field data-invalid={!!errors?.note}>
          <FieldLabel htmlFor="note">Anything else? (optional)</FieldLabel>
          <Textarea
            id="note"
            name="note"
            maxLength={500}
            placeholder="When you need it, where to deliver, …"
            aria-invalid={!!errors?.note}
          />
          <FieldError errors={toErrors(errors?.note)} />
        </Field>
      </FieldGroup>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">
          Total{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatMoney(total)}
          </span>
        </span>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Send order
        </Button>
      </div>
    </form>
  )
}
