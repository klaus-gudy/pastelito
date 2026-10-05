"use client"

import { useActionState, useState } from "react"
import { Plus } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  createCustomer,
  updateCustomer,
  type CustomerFormState,
} from "@/lib/actions/customers"
import { formatPhone } from "@/lib/format"

export type EditableCustomer = {
  id: string
  name: string
  phone: string | null
  email: string | null
}

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

/** Adds a customer, or edits `customer` when given. */
function CustomerForm({
  customer,
  onSaved,
}: {
  customer?: EditableCustomer
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: CustomerFormState, formData: FormData) => {
      const result = await (customer ? updateCustomer : createCustomer)(
        previous,
        formData
      )
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
  // After an error, show what was typed; otherwise the saved details.
  const values = state?.values ?? {
    name: customer?.name ?? "",
    phone: customer?.phone ? formatPhone(customer.phone) : "",
    email: customer?.email ?? "",
  }

  return (
    <form action={action} className="grid gap-6">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <FieldGroup>
        <Field data-invalid={!!errors?.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="e.g. Amina Hassan"
            autoComplete="off"
            defaultValue={values?.name}
            aria-invalid={!!errors?.name}
            required
            autoFocus
          />
          <FieldError errors={toErrors(errors?.name)} />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors?.phone}>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Optional"
              autoComplete="off"
              defaultValue={values?.phone}
              aria-invalid={!!errors?.phone}
            />
            <FieldError errors={toErrors(errors?.phone)} />
          </Field>
          <Field data-invalid={!!errors?.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Optional"
              autoComplete="off"
              defaultValue={values?.email}
              aria-invalid={!!errors?.email}
            />
            <FieldError errors={toErrors(errors?.email)} />
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
          {pending ? "Saving…" : customer ? "Save changes" : "Add customer"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AddCustomerDialog({ verified }: { verified: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Add customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>
            People you sell to. A phone number helps you reach them about
            preorders and payments.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <CustomerForm onSaved={() => setOpen(false)} />
        ) : (
          <VerifyFirst action="add customers" />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Opened from elsewhere, e.g. a menu, so it has no trigger of its own. */
export function EditCustomerDialog({
  customer,
  verified,
  open,
  onOpenChange,
}: {
  customer: EditableCustomer
  verified: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>
            Changes show everywhere this customer appears.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <CustomerForm customer={customer} onSaved={() => onOpenChange(false)} />
        ) : (
          <VerifyFirst action="edit customers" />
        )}
      </DialogContent>
    </Dialog>
  )
}
