"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ClipboardList,
  Eye,
  MoreHorizontal,
  Pencil,
  ShoppingCart,
} from "lucide-react"

import {
  EditCustomerDialog,
  type EditableCustomer,
} from "@/components/customers/add-customer-dialog"
import {
  NewSaleDialog,
  type SaleProductOption,
} from "@/components/sales/new-sale-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** View, plus a menu to edit the customer or record a sale or preorder. */
export function CustomerRowActions({
  customer,
  products,
  verified,
  today,
}: {
  customer: EditableCustomer
  products: SaleProductOption[]
  verified: boolean
  today: string
}) {
  const [editing, setEditing] = useState(false)
  const [selling, setSelling] = useState(false)
  const [preordering, setPreordering] = useState(false)
  const owner = { id: customer.id, name: customer.name }
  // A sale needs something to sell.
  const noProducts = products.length === 0

  return (
    <>
      <Button asChild variant="outline" size="sm">
        <Link href={`/customers/${customer.id}`}>
          <Eye data-icon="inline-start" />
          View
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
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
            disabled={noProducts}
            onSelect={() => setSelling(true)}
          >
            <ShoppingCart />
            New sale
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={noProducts}
            onSelect={() => setPreordering(true)}
          >
            <ClipboardList />
            New preorder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditCustomerDialog
        customer={customer}
        verified={verified}
        open={editing}
        onOpenChange={setEditing}
      />
      <NewSaleDialog
        open={selling}
        onOpenChange={setSelling}
        verified={verified}
        today={today}
        customers={[]}
        products={products}
        fixedCustomer={owner}
      />
      <NewSaleDialog
        preorder
        open={preordering}
        onOpenChange={setPreordering}
        verified={verified}
        today={today}
        customers={[]}
        products={products}
        fixedCustomer={owner}
      />
    </>
  )
}
