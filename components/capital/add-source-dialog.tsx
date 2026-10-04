"use client"

import { useActionState, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  createCapitalSource,
  type CapitalFormState,
} from "@/lib/actions/capital"
import { capitalSourceTypes } from "@/lib/labels"

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

function SourceForm({
  today,
  onSaved,
}: {
  today: string
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: CapitalFormState, formData: FormData) => {
      const result = await createCapitalSource(previous, formData)
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
          <FieldLabel htmlFor="name">Who gave the money?</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="e.g. My savings, Uncle Juma, CRDB loan"
            defaultValue={values?.name}
            aria-invalid={!!errors?.name}
            required
            autoFocus
          />
          <FieldError errors={toErrors(errors?.name)} />
        </Field>
        <FieldSet data-invalid={!!errors?.type}>
          <FieldLegend variant="label">Type</FieldLegend>
          <RadioGroup
            name="type"
            defaultValue={values?.type || "OWNER"}
            className="grid gap-2 sm:grid-cols-3"
          >
            {Object.entries(capitalSourceTypes).map(
              ([value, { label, description }]) => (
                <FieldLabel key={value} htmlFor={`type-${value}`}>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>{label}</FieldTitle>
                      <FieldDescription>{description}</FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value={value} id={`type-${value}`} />
                  </Field>
                </FieldLabel>
              )
            )}
          </RadioGroup>
          <FieldError errors={toErrors(errors?.type)} />
        </FieldSet>
        <FieldSet>
          <FieldLegend variant="label">Money received (optional)</FieldLegend>
          <FieldDescription>
            Record the first amount now, or add it later.
          </FieldDescription>
          <FieldGroup>
            <PaymentFields
              errors={errors}
              values={values}
              today={today}
              required={false}
            />
          </FieldGroup>
        </FieldSet>
        <Field data-invalid={!!errors?.note}>
          <FieldLabel htmlFor="note">Note</FieldLabel>
          <Textarea
            id="note"
            name="note"
            placeholder="Optional, e.g. repay by December"
            defaultValue={values?.note}
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
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add source"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AddSourceDialog({
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
          Add source
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add capital source</DialogTitle>
          <DialogDescription>
            Where money for the business comes from: your own savings, an
            investor, or a loan.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <SourceForm today={today} onSaved={() => setOpen(false)} />
        ) : (
          <VerifyFirst action="add capital" />
        )}
      </DialogContent>
    </Dialog>
  )
}
