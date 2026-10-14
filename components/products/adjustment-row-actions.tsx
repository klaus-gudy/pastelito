"use client"

import { useState } from "react"
import { MoreHorizontal, Undo2 } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteStockAdjustment } from "@/lib/actions/stock"

/** A "…" menu to undo one stock adjustment. */
export function AdjustmentRowActions({
  id,
  /** e.g. "3 units taken out of Oud Wood 50 ml" */
  what,
}: {
  id: string
  what: string
}) {
  const [undoing, setUndoing] = useState(false)

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
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setUndoing(true)}
          >
            <Undo2 />
            Undo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDeleteDialog
        open={undoing}
        onOpenChange={setUndoing}
        title="Undo this adjustment?"
        description={`The ${what} is reversed: the stock goes back to what it was and the adjustment is removed.`}
        action={() => deleteStockAdjustment(id)}
        confirmLabel="Undo"
        pendingLabel="Undoing…"
      />
    </>
  )
}
