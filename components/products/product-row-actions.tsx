"use client"

import { useState } from "react"
import { ArrowDownUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { AdjustStockDialog } from "@/components/products/adjust-stock-dialog"
import {
  EditProductDialog,
  type EditableProduct,
} from "@/components/products/add-product-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteProduct } from "@/lib/actions/products"

/** A "…" menu to edit the product, adjust its stock, or delete it. */
export function ProductRowActions({
  product,
  quantityOnHand,
  verified,
}: {
  product: EditableProduct
  quantityOnHand: number
  verified: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`More actions for ${product.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-40">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAdjusting(true)}>
            <ArrowDownUp />
            Adjust stock
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

      <EditProductDialog
        product={product}
        verified={verified}
        open={editing}
        onOpenChange={setEditing}
      />
      <AdjustStockDialog
        product={{
          id: product.id,
          name: product.name,
          sizeMl: product.sizeMl,
          quantityOnHand,
        }}
        verified={verified}
        open={adjusting}
        onOpenChange={setAdjusting}
      />
      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${product.name} ${product.sizeMl} ml?`}
        description="It is removed from your products and can't be picked for new sales or purchases. Past sales and purchases stay in your records."
        action={() => deleteProduct(product.id)}
      />
    </>
  )
}
