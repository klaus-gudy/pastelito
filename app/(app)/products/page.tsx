import type { Metadata } from "next"
import { Package } from "lucide-react"

import { AddProductDialog } from "@/components/products/add-product-dialog"
import { ProductsTable } from "@/components/products/products-table"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { requireUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Products · Pastelito" }

export default async function ProductsPage() {
  const user = await requireUser()
  const verified = Boolean(user.emailVerified)

  const products = await prisma.product.findMany({
    where: { userId: user.id },
    orderBy: [{ active: "desc" }, { name: "asc" }, { sizeMl: "asc" }],
  })

  return (
    <div className="flex flex-1 flex-col gap-6">
      {products.length > 0 && (
        <div className="flex justify-end">
          <AddProductDialog verified={verified} />
        </div>
      )}

      {products.length === 0 ? (
        <Empty className="flex-1 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package />
            </EmptyMedia>
            <EmptyTitle>No products yet</EmptyTitle>
            <EmptyDescription>
              Add the perfumes you sell. Each size is its own product, so add
              50 ml and 100 ml separately.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <AddProductDialog verified={verified} />
          </EmptyContent>
        </Empty>
      ) : (
        <ProductsTable products={products} />
      )}
    </div>
  )
}
