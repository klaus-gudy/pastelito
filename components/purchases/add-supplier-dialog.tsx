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
  createSupplier,
  updateSupplier,
  type SupplierFormState,
} from "@/lib/actions/purchases"

export type EditableSupplier = {
  id: string
  name: string
  phone: string | null
}

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

/** Adds a supplier, or edits `supplier` when given. */
function SupplierForm({
  supplier,
  onSaved,
}: {
  supplier?: EditableSupplier
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: SupplierFormState, formData: FormData) => {
      const result = await (supplier ? updateSupplier : createSupplier)(
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
  const values = state?.values ??
    (supplier && { name: supplier.name, phone: supplier.phone ?? "" })

  return (
    <form action={action} className="grid gap-6">
      {supplier && <input type="hidden" name="id" value={supplier.id} />}
      <FieldGroup>
        <Field data-invalid={!!errors?.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="e.g. Kariakoo Perfumes"
            defaultValue={values?.name}
            aria-invalid={!!errors?.name}
            required
            autoFocus
          />
          <FieldError errors={toErrors(errors?.name)} />
        </Field>
        <Field data-invalid={!!errors?.phone}>
          <FieldLabel htmlFor="phone">Phone</FieldLabel>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Optional"
            defaultValue={values?.phone}
            aria-invalid={!!errors?.phone}
          />
          <FieldError errors={toErrors(errors?.phone)} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : supplier ? "Save changes" : "Add supplier"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AddSupplierDialog({ verified }: { verified: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Add supplier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add supplier</DialogTitle>
          <DialogDescription>
            Who you buy stock from. You can also type a new supplier when
            recording a purchase.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <SupplierForm onSaved={() => setOpen(false)} />
        ) : (
          <VerifyFirst action="add suppliers" />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Opened from a menu, so it has no trigger of its own. */
export function EditSupplierDialog({
  supplier,
  verified,
  open,
  onOpenChange,
}: {
  supplier: EditableSupplier
  verified: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit supplier</DialogTitle>
          <DialogDescription>
            Change the name or phone. Past purchases show the new name.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <SupplierForm
            supplier={supplier}
            onSaved={() => onOpenChange(false)}
          />
        ) : (
          <VerifyFirst action="edit suppliers" />
        )}
      </DialogContent>
    </Dialog>
  )
}
