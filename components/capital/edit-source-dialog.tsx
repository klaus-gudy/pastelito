"use client"

import { useActionState } from "react"
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
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  updateCapitalSource,
  type CapitalFormState,
} from "@/lib/actions/capital"
import { capitalSourceTypes } from "@/lib/labels"

export type EditableSource = {
  id: string
  name: string
  type: keyof typeof capitalSourceTypes
}

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

function EditSourceForm({
  source,
  onSaved,
}: {
  source: EditableSource
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: CapitalFormState, formData: FormData) => {
      const result = await updateCapitalSource(previous, formData)
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
  const values = state?.values ?? { name: source.name, type: source.type }

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="id" value={source.id} />
      <FieldGroup>
        <Field data-invalid={!!errors?.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            autoComplete="off"
            defaultValue={values.name}
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
            defaultValue={values.type}
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

/** Opened from a menu, so it has no trigger of its own. */
export function EditSourceDialog({
  source,
  verified,
  open,
  onOpenChange,
}: {
  source: EditableSource
  verified: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit capital source</DialogTitle>
          <DialogDescription>
            Change the name or type. Amounts already recorded stay as they are.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <EditSourceForm
            source={source}
            onSaved={() => onOpenChange(false)}
          />
        ) : (
          <VerifyFirst action="edit capital" />
        )}
      </DialogContent>
    </Dialog>
  )
}
