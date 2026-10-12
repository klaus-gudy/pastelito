"use client"

import { useState } from "react"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import {
  EditEntryDialog,
  type EditableEntry,
} from "@/components/capital/edit-entry-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteCapitalEntry } from "@/lib/actions/capital"

/** A "…" menu to edit or delete one history entry. */
export function EntryRowActions({
  entry,
  verified,
  today,
  /** Pre-formatted, e.g. "TZS 500,000". */
  amount,
}: {
  entry: EditableEntry
  verified: boolean
  today: string
  amount: string
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const what =
    entry.type === "REPAID"
      ? `repayment of ${amount} to ${entry.sourceName}`
      : `${amount} received from ${entry.sourceName}`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`More actions for ${what}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-40">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleting(true)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditEntryDialog
        entry={entry}
        verified={verified}
        today={today}
        open={editing}
        onOpenChange={setEditing}
      />
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this entry?"
        description={`The ${what} is removed from your records and your balances change. This can't be undone.`}
        action={() => deleteCapitalEntry(entry.id)}
      />
    </>
  )
}
