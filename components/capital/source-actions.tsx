"use client"

import { useActionState, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  EditSourceDialog,
  type EditableSource,
} from "@/components/capital/edit-source-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
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
  deleteCapitalSource,
  recordCapitalEntry,
  type CapitalFormState,
} from "@/lib/actions/capital"

type EntryType = "RECEIVED" | "REPAID"

type Source = EditableSource & {
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

/** Row buttons for a capital source: receive, repay; a menu to edit or delete. */
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
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setType("RECEIVED")}>
          <ArrowDownLeft data-icon="inline-start" />
          Receive
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!source.hasOutstanding}
          onClick={() => setType("REPAID")}
        >
          <ArrowUpRight data-icon="inline-start" />
          Repay
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={`More actions for ${source.name}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-40">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil />
              Edit source
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleting(true)}
            >
              <Trash2 />
              Delete source
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <EditSourceDialog
        source={source}
        verified={verified}
        open={editing}
        onOpenChange={setEditing}
      />
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${source.name}?`}
        description="It is removed from your capital sources. Money already recorded stays in the history."
        action={() => deleteCapitalSource(source.id)}
      />

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
