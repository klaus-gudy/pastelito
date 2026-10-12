"use client"

import { useActionState } from "react"
import { toast } from "sonner"

import { PaymentFields } from "@/components/capital/payment-fields"
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  updateCapitalEntry,
  type CapitalFormState,
} from "@/lib/actions/capital"

export type EditableEntry = {
  id: string
  type: "RECEIVED" | "REPAID"
  sourceName: string
  /** Whole shillings as digits, e.g. "500000". */
  amount: string
  method: string
  /** "YYYY-MM-DD" */
  date: string
  note: string
}

function EntryEditForm({
  entry,
  today,
  onSaved,
}: {
  entry: EditableEntry
  today: string
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: CapitalFormState, formData: FormData) => {
      const result = await updateCapitalEntry(previous, formData)
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
    amount: entry.amount,
    method: entry.method,
    date: entry.date,
    note: entry.note,
  }

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="id" value={entry.id} />
      <FieldGroup>
        <PaymentFields
          errors={errors}
          values={values}
          today={today}
          amountLabel={
            entry.type === "REPAID" ? "Amount repaid" : "Amount received"
          }
        />
        <Field data-invalid={!!errors?.note}>
          <FieldLabel htmlFor="note">Note</FieldLabel>
          <Textarea
            id="note"
            name="note"
            placeholder="Optional"
            defaultValue={values.note}
            aria-invalid={!!errors?.note}
          />
          <FieldError errors={errors?.note?.map((message) => ({ message }))} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Opened from a "…" menu, so it has no trigger of its own. */
export function EditEntryDialog({
  entry,
  verified,
  today,
  open,
  onOpenChange,
}: {
  entry: EditableEntry
  verified: boolean
  today: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {entry.type === "REPAID"
              ? `Edit repayment to ${entry.sourceName}`
              : `Edit money from ${entry.sourceName}`}
          </DialogTitle>
          <DialogDescription>
            Fix a mistake in this entry. The source and type can&apos;t be
            changed.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <EntryEditForm
            entry={entry}
            today={today}
            onSaved={() => onOpenChange(false)}
          />
        ) : (
          <VerifyFirst action="edit capital" />
        )}
      </DialogContent>
    </Dialog>
  )
}
