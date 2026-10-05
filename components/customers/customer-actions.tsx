"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ellipsis, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  EditCustomerDialog,
  type EditableCustomer,
} from "@/components/customers/add-customer-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteCustomer } from "@/lib/actions/customers"

/** The ⋯ menu on a customer's page: edit, or soft-delete them. */
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
  const [pending, startTransition] = useTransition()

  return (
    <>
      {/* Not modal, so the dialogs it opens get focus and pointer events. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={`More actions for ${customer.name}`}
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleting(true)}
          >
            <Trash2 />
            Delete customer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditCustomerDialog
        customer={customer}
        verified={verified}
        open={editing}
        onOpenChange={setEditing}
      />

      <AlertDialog
        open={deleting}
        onOpenChange={(open) => !open && !pending && setDeleting(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {customer.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They are removed from your customers and can&apos;t be picked
              for new sales. Their past sales and payments stay in your
              records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                // Stay open until the server answers.
                event.preventDefault()
                startTransition(async () => {
                  const result = await deleteCustomer(customer.id)
                  if (result.success) {
                    toast.success(result.message)
                    router.push("/customers")
                  } else {
                    toast.error(result.message)
                    setDeleting(false)
                  }
                })
              }}
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
