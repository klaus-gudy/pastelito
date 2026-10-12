"use client"

import { useState } from "react"
import { MoreHorizontal, Pencil } from "lucide-react"

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

/** A "…" menu to edit the product. */
export function ProductRowActions({
  product,
  verified,
}: {
  product: EditableProduct
  verified: boolean
}) {
  const [editing, setEditing] = useState(false)

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
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProductDialog
        product={product}
        verified={verified}
        open={editing}
        onOpenChange={setEditing}
      />
    </>
  )
}
