"use client"

import { useActionState, useState } from "react"
import { MailWarning, Plus } from "lucide-react"
import { toast } from "sonner"

import { MoneyInput } from "@/components/money-input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { resendVerificationEmail } from "@/lib/actions/auth"
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
      } else if (result?.message) {
        toast.error(result.message)
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
            placeholder="e.g. Pastelito large"
            defaultValue={values?.name}
            aria-invalid={!!errors?.name}
            required
            autoFocus
          />
          <FieldError errors={toErrors(errors?.name)} />
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
                <InputGroupText>TZS</InputGroupText>
              </InputGroupAddon>
              <MoneyInput
                id="sellingPrice"
                name="sellingPrice"
                placeholder="45,000"
                defaultValue={values?.sellingPrice}
                aria-invalid={!!errors?.sellingPrice}
                required
              />
            </InputGroup>
            <FieldError errors={toErrors(errors?.sellingPrice)} />
          </Field>
        </div>
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

// Shown instead of the form until the user's email is verified.
function VerifyFirst() {
  const [state, resend, pending] = useActionState(async () => {
    const result = await resendVerificationEmail()
    if (result?.sent) toast.success("Verification email sent.")
    else if (result?.message) toast.info(result.message)
    return result
  }, undefined)

  return (
    <div className="grid gap-6">
      <Alert>
        <MailWarning />
        <AlertTitle>Verify your email to add products</AlertTitle>
        <AlertDescription>
          Open the link we emailed you, then come back to add products.
        </AlertDescription>
      </Alert>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Close
          </Button>
        </DialogClose>
        <form action={resend}>
          <Button type="submit" disabled={pending || state?.sent}>
            {pending
              ? "Sending…"
              : state?.sent
                ? "Email sent"
                : "Resend verification email"}
          </Button>
        </form>
      </DialogFooter>
    </div>
  )
}

export function AddProductDialog({ verified }: { verified: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Add product
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
        </DialogHeader>
        {verified ? (
          <ProductForm onSaved={() => setOpen(false)} />
        ) : (
          <VerifyFirst />
        )}
      </DialogContent>
    </Dialog>
  )
}
