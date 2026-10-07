import type { Metadata } from "next"
import { Package, SearchX } from "lucide-react"

import { LoadMore } from "@/components/load-more"
import { AddProductDialog } from "@/components/products/add-product-dialog"
import { ProductsTable } from "@/components/products/products-table"
import { TableSearch } from "@/components/table-search"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { requireUser } from "@/lib/current-user"
import type { Prisma } from "@/lib/generated/prisma/client"
import { shownCount } from "@/lib/list-size"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Products · Pastelito" }

const PAGE_SIZE = 10

export default async function ProductsPage({
  searchParams,
}: PageProps<"/products">) {
  const user = await requireUser()
  const verified = Boolean(user.emailVerified)

  const params = await searchParams
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : ""
  const shown = shownCount(params.show, PAGE_SIZE)

  const where: Prisma.ProductWhereInput = {
    userId: user.id,
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    }),
  }

  const total = await prisma.product.count({ where })

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }, { sizeMl: "asc" }],
    take: shown,
  })

  if (!q && total === 0) {
    return (
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
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TableSearch
          defaultValue={q}
          placeholder="Search products"
          label="Search products"
        />
        <AddProductDialog verified={verified} />
      </div>

      {total === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>No matches</EmptyTitle>
            <EmptyDescription>
              No products match &ldquo;{q}&rdquo;.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ProductsTable products={products} />
          <LoadMore
            shown={shown}
            pageSize={PAGE_SIZE}
            total={total}
            params={q ? { q } : undefined}
          />
        </>
      )}
    </div>
  )
}
