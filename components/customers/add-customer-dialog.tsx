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
  type CustomerFormState,
} from "@/lib/actions/customers"

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

function CustomerForm({ onSaved }: { onSaved: () => void }) {
  const [state, action, pending] = useActionState(
    async (previous: CustomerFormState, formData: FormData) => {
      const result = await createCustomer(previous, formData)
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
          {pending ? "Saving…" : "Add customer"}
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
