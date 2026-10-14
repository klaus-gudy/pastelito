"use client"

import { useState } from "react"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { removeSalePayment } from "@/lib/actions/sales"

/** A "…" menu to edit or delete one payment on a sale. */
export function PaymentRowActions({
  paymentId,
  /** e.g. "TZS 20,000 paid on 12 Oct 2026" */
  what,
  onEdit,
}: {
  paymentId: string
  what: string
  onEdit: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`More actions for ${what}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-40">
          <DropdownMenuItem onSelect={onEdit}>
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
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this payment?"
        description={`The ${what} is removed: it comes out of your cash and back onto what the customer owes.`}
        action={() => removeSalePayment(paymentId)}
      />
    </>
  )
}
