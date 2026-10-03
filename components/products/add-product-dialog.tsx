"use client"

import { useActionState, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { createProduct, type ProductFormState } from "@/lib/actions/products"

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

// Mounted only while the dialog is open, so each opening starts fresh.
function ProductForm({ onSaved }: { onSaved: () => void }) {
  const [state, action, pending] = useActionState(
    async (previous: ProductFormState, formData: FormData) => {
      const result = await createProduct(previous, formData)
      if (result?.success) {
        toast.success(result.message)
        onSaved()
      }
      return result
    },
    undefined
  )
  const errors = state?.errors
  const values = state?.values

  return (
    <form action={action} className="grid gap-6">
      <FieldGroup>
        <Field data-invalid={!!errors?.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="e.g. Sauvage"
            defaultValue={values?.name}
            aria-invalid={!!errors?.name}
            required
            autoFocus
          />
          <FieldError errors={toErrors(errors?.name)} />
        </Field>
        <Field data-invalid={!!errors?.brand}>
          <FieldLabel htmlFor="brand">Brand</FieldLabel>
          <Input
            id="brand"
            name="brand"
            placeholder="e.g. Dior"
            defaultValue={values?.brand}
            aria-invalid={!!errors?.brand}
          />
          <FieldError errors={toErrors(errors?.brand)} />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors?.sizeMl}>
            <FieldLabel htmlFor="sizeMl">Size</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="sizeMl"
                name="sizeMl"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="100"
                defaultValue={values?.sizeMl}
                aria-invalid={!!errors?.sizeMl}
                required
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>ml</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={toErrors(errors?.sizeMl)} />
          </Field>
          <Field data-invalid={!!errors?.sellingPrice}>
            <FieldLabel htmlFor="sellingPrice">Selling price</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>TSh</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="sellingPrice"
                name="sellingPrice"
                inputMode="decimal"
                placeholder="45000"
                defaultValue={values?.sellingPrice}
                aria-invalid={!!errors?.sellingPrice}
                required
              />
            </InputGroup>
            <FieldError errors={toErrors(errors?.sellingPrice)} />
          </Field>
        </div>
        <Field data-invalid={!!errors?.sku}>
          <FieldLabel htmlFor="sku">SKU</FieldLabel>
          <Input
            id="sku"
            name="sku"
            placeholder="Optional"
            defaultValue={values?.sku}
            aria-invalid={!!errors?.sku}
          />
          {errors?.sku ? (
            <FieldError errors={toErrors(errors.sku)} />
          ) : (
            <FieldDescription>
              Your own code for this product, if you use one.
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add product"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AddProductDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Add product
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
          <DialogDescription>
            Each size is its own product. Stock is added when you record a
            purchase.
          </DialogDescription>
        </DialogHeader>
        <ProductForm onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
