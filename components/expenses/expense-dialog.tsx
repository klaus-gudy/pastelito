"use client"

import { startTransition, useActionState, useState } from "react"
import { Plus } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  createExpense,
  updateExpense,
  type ExpenseFormState,
} from "@/lib/actions/expenses"
import { expenseCategories } from "@/lib/labels"

export type EditableExpense = {
  id: string
  category: string
  /** Whole shillings as digits, e.g. "50000". */
  amount: string
  method: string
  /** "YYYY-MM-DD" */
  date: string
  description: string
}

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

/** Records an expense, or corrects `expense` when given. */
function ExpenseForm({
  expense,
  today,
  onSaved,
}: {
  expense?: EditableExpense
  today: string
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: ExpenseFormState, formData: FormData) => {
      const result = await (expense ? updateExpense : createExpense)(
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
  const values = state?.values ?? expense
  const [category, setCategory] = useState(values?.category ?? "")

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
      {expense && <input type="hidden" name="id" value={expense.id} />}
      <FieldGroup>
        <Field data-invalid={!!errors?.category}>
          <FieldLabel htmlFor="category">What for</FieldLabel>
          <Select name="category" value={category} onValueChange={setCategory}>
            <SelectTrigger
              id="category"
              className="w-full"
              aria-invalid={!!errors?.category}
            >
              <SelectValue placeholder="Pick a category" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(expenseCategories).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={toErrors(errors?.category)} />
        </Field>
        <PaymentFields
          errors={errors}
          values={values}
          today={today}
          amountLabel="Amount paid"
        />
        <Field data-invalid={!!errors?.description}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            id="description"
            name="description"
            placeholder="Optional, e.g. October shop rent"
            defaultValue={values?.description}
            aria-invalid={!!errors?.description}
          />
          <FieldError errors={toErrors(errors?.description)} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : expense ? "Save changes" : "Add expense"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AddExpenseDialog({
  verified,
  today,
}: {
  verified: boolean
  today: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Add expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>
            Money spent running the business, like rent or transport. Stock
            you buy goes under Purchases instead.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <ExpenseForm today={today} onSaved={() => setOpen(false)} />
        ) : (
          <VerifyFirst action="add expenses" />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Opened from a "…" menu, so it has no trigger of its own. */
export function EditExpenseDialog({
  expense,
  verified,
  today,
  open,
  onOpenChange,
}: {
  expense: EditableExpense
  verified: boolean
  today: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
          <DialogDescription>Fix a mistake in this expense.</DialogDescription>
        </DialogHeader>
        {verified ? (
          <ExpenseForm
            expense={expense}
            today={today}
            onSaved={() => onOpenChange(false)}
          />
        ) : (
          <VerifyFirst action="edit expenses" />
        )}
      </DialogContent>
    </Dialog>
  )
}
