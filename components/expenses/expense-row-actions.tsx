"use client"

import { useState } from "react"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import {
  EditExpenseDialog,
  type EditableExpense,
} from "@/components/expenses/expense-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteExpense } from "@/lib/actions/expenses"

/** A "…" menu to edit or delete one expense. */
export function ExpenseRowActions({
  expense,
  verified,
  today,
  /** e.g. "Rent expense of TZS 300,000" */
  what,
}: {
  expense: EditableExpense
  verified: boolean
  today: string
  what: string
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

      <EditExpenseDialog
        expense={expense}
        verified={verified}
        today={today}
        open={editing}
        onOpenChange={setEditing}
      />
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this expense?"
        description={`The ${what} is removed and its money goes back into your cash. This can't be undone.`}
        action={() => deleteExpense(expense.id)}
      />
    </>
  )
}
