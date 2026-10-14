"use client"

import { startTransition, useActionState, useState } from "react"
import { PackageMinus, PackagePlus } from "lucide-react"
import { toast } from "sonner"

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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  recordStockAdjustment,
  type StockAdjustmentFormState,
} from "@/lib/actions/stock"
import { formatCount } from "@/lib/format"
import { stockAdjustmentReasons } from "@/lib/labels"

export type AdjustableProduct = {
  id: string
  name: string
  sizeMl: number
  quantityOnHand: number
}

type Direction = "out" | "in"

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

const reasonsFor = (direction: Direction) =>
  Object.entries(stockAdjustmentReasons).filter(
    ([, reason]) =>
      reason.direction === "both" || reason.direction === direction
  )

function AdjustStockForm({
  product,
  onSaved,
}: {
  product: AdjustableProduct
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: StockAdjustmentFormState, formData: FormData) => {
      const result = await recordStockAdjustment(previous, formData)
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
  // With nothing in stock, the only way is in.
  const [direction, setDirection] = useState<Direction>(
    product.quantityOnHand > 0 ? "out" : "in"
  )
  const [reason, setReason] = useState("")
  const [quantity, setQuantity] = useState("")
  const reasons = reasonsFor(direction)
  // Switching direction drops a reason that only fits the other one.
  const shownReason = reasons.some(([value]) => value === reason) ? reason : ""
  const count = Number(quantity)
  const after =
    Number.isInteger(count) && count > 0
      ? product.quantityOnHand + (direction === "out" ? -count : count)
      : null

  return (
    // Submitted via onSubmit rather than `action` so React doesn't reset the
    // form afterwards; a reset would clear the pickers on a server error.
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        startTransition(() => action(formData))
      }}
    >
      <input type="hidden" name="productId" value={product.id} />
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">Change</FieldLegend>
          <RadioGroup
            name="direction"
            value={direction}
            onValueChange={(value) => setDirection(value as Direction)}
            className="grid gap-2 sm:grid-cols-2"
          >
            <FieldLabel htmlFor="direction-out">
              <Field
                orientation="horizontal"
                data-disabled={product.quantityOnHand <= 0 || undefined}
              >
                <PackageMinus className="mt-0.5 size-4 shrink-0" />
                <FieldContent>
                  <FieldTitle>Take out</FieldTitle>
                  <FieldDescription>
                    {product.quantityOnHand > 0
                      ? "Testers, breakage, losses."
                      : "Nothing in stock."}
                  </FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  value="out"
                  id="direction-out"
                  disabled={product.quantityOnHand <= 0}
                />
              </Field>
            </FieldLabel>
            <FieldLabel htmlFor="direction-in">
              <Field orientation="horizontal">
                <PackagePlus className="mt-0.5 size-4 shrink-0" />
                <FieldContent>
                  <FieldTitle>Add</FieldTitle>
                  <FieldDescription>Stock found or miscounted.</FieldDescription>
                </FieldContent>
                <RadioGroupItem value="in" id="direction-in" />
              </Field>
            </FieldLabel>
          </RadioGroup>
        </FieldSet>
        <div className="grid gap-6 sm:grid-cols-[1fr_2fr]">
          <Field data-invalid={!!errors?.quantity}>
            <FieldLabel htmlFor="quantity">Units</FieldLabel>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={direction === "out" ? product.quantityOnHand : undefined}
              step={1}
              placeholder="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-invalid={!!errors?.quantity}
              required
              autoFocus
            />
          </Field>
          <Field data-invalid={!!errors?.reason}>
            <FieldLabel htmlFor="reason">Reason</FieldLabel>
            <Select name="reason" value={shownReason} onValueChange={setReason}>
              <SelectTrigger
                id="reason"
                className="w-full"
                aria-invalid={!!errors?.reason}
              >
                <SelectValue placeholder="Pick a reason" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map(([value, { label }]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={toErrors(errors?.reason)} />
          </Field>
        </div>
        {errors?.quantity ? (
          <FieldError errors={toErrors(errors.quantity)} />
        ) : (
          <FieldDescription>
            {formatCount(product.quantityOnHand)} in stock now
            {after !== null &&
              (after < 0
                ? ", so you can't take out that many."
                : `, ${formatCount(after)} after this.`)}
          </FieldDescription>
        )}
        <Field data-invalid={!!errors?.note}>
          <FieldLabel htmlFor="note">Note</FieldLabel>
          <Textarea
            id="note"
            name="note"
            placeholder="Optional, e.g. opened as a shop tester"
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
        <Button type="submit" disabled={pending || (after !== null && after < 0)}>
          {pending ? "Saving…" : "Adjust stock"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Opened from a menu, so it has no trigger of its own. */
export function AdjustStockDialog({
  product,
  verified,
  open,
  onOpenChange,
}: {
  product: AdjustableProduct
  verified: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Adjust stock of {product.name} {formatCount(product.sizeMl)} ml
          </DialogTitle>
          <DialogDescription>
            For stock that leaves or turns up without a sale or purchase.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <AdjustStockForm
            product={product}
            onSaved={() => onOpenChange(false)}
          />
        ) : (
          <VerifyFirst action="adjust stock" />
        )}
      </DialogContent>
    </Dialog>
  )
}
