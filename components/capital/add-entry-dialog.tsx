"use client"

import { startTransition, useActionState, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react"
import { toast } from "sonner"

import { PaymentFields } from "@/components/capital/payment-fields"
import { VerifyFirst } from "@/components/verify-first"
import { Badge } from "@/components/ui/badge"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  recordCapitalEntry,
  type CapitalFormState,
} from "@/lib/actions/capital"

export type SourceOption = {
  id: string
  name: string
  typeLabel: string
  /** Pre-formatted, e.g. "TZS 500,000". */
  outstanding: string
  hasOutstanding: boolean
}

const toErrors = (messages?: string[]) =>
  messages?.map((message) => ({ message }))

function EntryForm({
  sources,
  today,
  onSaved,
}: {
  sources: SourceOption[]
  today: string
  onSaved: () => void
}) {
  const [state, action, pending] = useActionState(
    async (previous: CapitalFormState, formData: FormData) => {
      const result = await recordCapitalEntry(previous, formData)
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
  const [sourceId, setSourceId] = useState(state?.values?.sourceId ?? "")
  const [type, setType] = useState(state?.values?.type || "RECEIVED")
  const source = sources.find((s) => s.id === sourceId)
  const canRepay = source?.hasOutstanding ?? false
  // Repaying is only possible while something is outstanding.
  const direction = type === "REPAID" && source && !canRepay ? "RECEIVED" : type

  return (
    // Submitted via onSubmit rather than `action` so React doesn't reset the
    // form afterwards; a reset would clear the chosen source and transaction
    // when the server returns an error.
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        startTransition(() => action(formData))
      }}
    >
      <FieldGroup>
        <Field data-invalid={!!errors?.sourceId}>
          <FieldLabel htmlFor="sourceId">Source</FieldLabel>
          <Select name="sourceId" value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger
              id="sourceId"
              className="w-full"
              aria-invalid={!!errors?.sourceId}
            >
              <SelectValue placeholder="Pick a source" />
            </SelectTrigger>
            <SelectContent>
              {sources.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                  <Badge variant="secondary">{option.typeLabel}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.sourceId ? (
            <FieldError errors={toErrors(errors.sourceId)} />
          ) : (
            source && (
              <FieldDescription>
                {source.typeLabel} · {source.outstanding} outstanding
              </FieldDescription>
            )
          )}
        </Field>
        <FieldSet>
          <FieldLegend variant="label">Transaction</FieldLegend>
          <RadioGroup
            name="type"
            value={direction}
            onValueChange={setType}
            className="grid gap-2 sm:grid-cols-2"
          >
            <FieldLabel htmlFor="type-RECEIVED">
              <Field orientation="horizontal">
                <ArrowDownLeft className="mt-0.5 size-4 shrink-0" />
                <FieldContent>
                  <FieldTitle>Receive</FieldTitle>
                  <FieldDescription>Money coming in.</FieldDescription>
                </FieldContent>
                <RadioGroupItem value="RECEIVED" id="type-RECEIVED" />
              </Field>
            </FieldLabel>
            <FieldLabel htmlFor="type-REPAID">
              <Field
                orientation="horizontal"
                data-disabled={source && !canRepay ? true : undefined}
              >
                <ArrowUpRight className="mt-0.5 size-4 shrink-0" />
                <FieldContent>
                  <FieldTitle>Repay</FieldTitle>
                  <FieldDescription>
                    {source && !canRepay
                      ? "Nothing outstanding."
                      : "Money going back."}
                  </FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  value="REPAID"
                  id="type-REPAID"
                  disabled={!!source && !canRepay}
                />
              </Field>
            </FieldLabel>
          </RadioGroup>
        </FieldSet>
        <PaymentFields errors={errors} values={state?.values} today={today} />
        <Field data-invalid={!!errors?.note}>
          <FieldLabel htmlFor="note">Note</FieldLabel>
          <Textarea
            id="note"
            name="note"
            placeholder="Optional"
            defaultValue={state?.values?.note}
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
          {pending ? "Saving…" : "Add entry"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AddEntryDialog({
  sources,
  verified,
  today,
}: {
  sources: SourceOption[]
  verified: boolean
  today: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Add entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add entry</DialogTitle>
          <DialogDescription>
            Record money received from a source, or a repayment to it.
          </DialogDescription>
        </DialogHeader>
        {verified ? (
          <EntryForm
            sources={sources}
            today={today}
            onSaved={() => setOpen(false)}
          />
        ) : (
          <VerifyFirst action="add entries" />
        )}
      </DialogContent>
    </Dialog>
  )
}
