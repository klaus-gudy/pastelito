"use client"

import { useActionState, useState } from "react"
import { Target } from "lucide-react"
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  updateHealthTargets,
  type HealthTargetsFormState,
} from "@/lib/actions/health"
import { DEFAULT_TARGETS, type Targets } from "@/lib/health"

const fields: {
  key: keyof Targets
  label: string
  unit: "%" | "days"
  hint: string
}[] = [
  { key: "marginPct", label: "Gross margin", unit: "%", hint: "At least this share of sales as profit." },
  { key: "collectionPct", label: "Collection rate", unit: "%", hint: "At least this share of sales collected." },
  { key: "salesTrendPct", label: "Sales trend", unit: "%", hint: "Change vs the period before; 0 means no drop." },
  { key: "stockMaxDays", label: "Stock cover", unit: "days", hint: "At most this many days of stock." },
  { key: "paybackPct", label: "Capital earned back", unit: "%", hint: "Profit as a share of capital put in." },
  { key: "overdueDays", label: "Overdue after", unit: "days", hint: "Unpaid sales older than this are overdue." },
  { key: "repeatPct", label: "Repeat customers", unit: "%", hint: "At least this share of buyers coming back." },
  { key: "preorderMaxDays", label: "Preorder wait", unit: "days", hint: "Longest a preorder should wait." },
]

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

function TargetsForm({
  saved,
  onSaved,
}: {
  saved: Partial<Record<keyof Targets, number | null>>
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: HealthTargetsFormState, formData: FormData) => {
      const result = await updateHealthTargets(previous, formData)
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
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <Field key={field.key} data-invalid={!!errors?.[field.key]}>
            <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id={field.key}
                name={field.key}
                inputMode="numeric"
                autoComplete="off"
                placeholder={String(DEFAULT_TARGETS[field.key])}
                defaultValue={
                  state?.values?.[field.key] ??
                  (saved[field.key] != null ? String(saved[field.key]) : "")
                }
                aria-invalid={!!errors?.[field.key]}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{field.unit}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>{field.hint}</FieldDescription>
            <FieldError errors={toErrors(errors?.[field.key])} />
          </Field>
        ))}
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save targets"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Lets the business set its own bar for each health indicator. */
export function EditTargetsDialog({
  saved,
  verified,
}: {
  /** The stored targets; null or missing means the default. */
  saved: Partial<Record<keyof Targets, number | null>>
  verified: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Target data-icon="inline-start" />
          Edit targets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Health targets</DialogTitle>
          <DialogDescription>
            The bar each indicator is judged against. Leave a field empty to
            use the default shown in it.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <TargetsForm saved={saved} onSaved={() => setOpen(false)} />
        ) : (
          <VerifyFirst action="set targets" />
        )}
      </DialogContent>
    </Dialog>
  )
}
