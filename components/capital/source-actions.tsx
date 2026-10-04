"use client"

import { useActionState, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal } from "lucide-react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  recordCapitalEntry,
  type CapitalFormState,
} from "@/lib/actions/capital"

type EntryType = "RECEIVED" | "REPAID"

type Source = {
  id: string
  name: string
  /** Pre-formatted, e.g. "TZS 500,000". */
  outstanding: string
  hasOutstanding: boolean
}

function EntryForm({
  source,
  type,
  today,
  onSaved,
}: {
  source: Source
  type: EntryType
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

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="sourceId" value={source.id} />
      <input type="hidden" name="type" value={type} />
      <FieldGroup>
        <PaymentFields
          errors={errors}
          values={state?.values}
          today={today}
          amountLabel={type === "REPAID" ? "Amount repaid" : "Amount received"}
        />
        <Field data-invalid={!!errors?.note}>
          <FieldLabel htmlFor="note">Note</FieldLabel>
          <Textarea
            id="note"
            name="note"
            placeholder="Optional"
            defaultValue={state?.values?.note}
            aria-invalid={!!errors?.note}
          />
          <FieldError
            errors={errors?.note?.map((message) => ({ message }))}
          />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : type === "REPAID"
              ? "Record repayment"
              : "Record money"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Row menu for a capital source: record more money or a repayment. */
export function SourceActions({
  source,
  verified,
  today,
}: {
  source: Source
  verified: boolean
  today: string
}) {
  const [type, setType] = useState<EntryType | null>(null)

  return (
    <>
      {/* Not modal, so closing the menu doesn't fight the dialog for focus. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${source.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setType("RECEIVED")}>
            <ArrowDownLeft />
            Record money received
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!source.hasOutstanding}
            onSelect={() => setType("REPAID")}
          >
            <ArrowUpRight />
            Record repayment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={type !== null}
        onOpenChange={(open) => !open && setType(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {type === "REPAID"
                ? `Repay ${source.name}`
                : `Money from ${source.name}`}
            </DialogTitle>
            <DialogDescription>
              {type === "REPAID"
                ? `Outstanding: ${source.outstanding}.`
                : "Record more money received from this source."}
            </DialogDescription>
          </DialogHeader>
          {type &&
            (verified ? (
              <EntryForm
                source={source}
                type={type}
                today={today}
                onSaved={() => setType(null)}
              />
            ) : (
              <VerifyFirst action="record capital" />
            ))}
        </DialogContent>
      </Dialog>
    </>
  )
}
