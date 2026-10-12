"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import {
  EditCustomerDialog,
  type EditableCustomer,
} from "@/components/customers/add-customer-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteCustomer } from "@/lib/actions/customers"

/** A "…" menu on a customer's page to edit or delete; delete is a soft delete. */
export function CustomerActions({
  customer,
  verified,
}: {
  customer: EditableCustomer
  verified: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={`More actions for ${customer.name}`}
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

      <EditCustomerDialog
        customer={customer}
        verified={verified}
        open={editing}
        onOpenChange={setEditing}
      />
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${customer.name}?`}
        description="They are removed from your customers and can't be picked for new sales. Their past sales and payments stay in your records."
        action={() => deleteCustomer(customer.id)}
        onDeleted={() => router.push("/customers")}
      />
    </>
  )
}
