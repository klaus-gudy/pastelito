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
  type SupplierFormState,
} from "@/lib/actions/purchases"

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

function SupplierForm({ onSaved }: { onSaved: () => void }) {
  const [state, action, pending] = useActionState(
    async (previous: SupplierFormState, formData: FormData) => {
      const result = await createSupplier(previous, formData)
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

  return (
    <form action={action} className="grid gap-6">
      <FieldGroup>
        <Field data-invalid={!!errors?.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="e.g. Kariakoo Perfumes"
            defaultValue={state?.values?.name}
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
            defaultValue={state?.values?.phone}
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
          {pending ? "Saving…" : "Add supplier"}
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
