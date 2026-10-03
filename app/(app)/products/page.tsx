import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Boxes, Coins, Package } from "lucide-react"

import { auth } from "@/auth"
import { findNavItem } from "@/components/dashboard/navigation"
import { AddProductDialog } from "@/components/products/add-product-dialog"
import { ProductsTable } from "@/components/products/products-table"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Prisma } from "@/lib/generated/prisma/client"
import { formatCount, formatMoney } from "@/lib/format"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Products · Pastelito" }

export default async function ProductsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/sign-in")

  const products = await prisma.product.findMany({
    where: { userId: session.user.id },
    orderBy: [{ active: "desc" }, { name: "asc" }, { sizeMl: "asc" }],
  })

  const unitsInStock = products.reduce((sum, p) => sum + p.quantityOnHand, 0)
  const stockValue = products.reduce(
    (sum, p) => sum.add(p.avgCost.mul(p.quantityOnHand)),
    new Prisma.Decimal(0)
  )
  const summary = [
    { label: "Products", value: formatCount(products.length), icon: Package },
    { label: "Units in stock", value: formatCount(unitsInStock), icon: Boxes },
    { label: "Stock value at cost", value: formatMoney(stockValue), icon: Coins },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Products</h2>
          <p className="mt-1 text-muted-foreground">
            {findNavItem("/products")?.question}
          </p>
        </div>
        {products.length > 0 && <AddProductDialog />}
      </div>

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
            <AddProductDialog />
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {summary.map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardHeader>
                  <CardDescription className="flex items-center gap-2">
                    <Icon className="size-4" />
                    {label}
                  </CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
          <ProductsTable products={products} />
        </>
      )}
    </div>
  )
}
