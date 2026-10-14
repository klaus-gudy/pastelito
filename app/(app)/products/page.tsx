import type { Metadata } from "next"
import { ArrowDownUp, Package, SearchX } from "lucide-react"

import { LoadMore } from "@/components/load-more"
import { AddProductDialog } from "@/components/products/add-product-dialog"
import { AdjustmentsTable } from "@/components/products/adjustments-table"
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
import { TabsContent } from "@/components/ui/tabs"
import { UrlTabs } from "@/components/url-tabs"
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
  const verified = user.verified

  const params = await searchParams
  const tab = params.tab === "adjustments" ? "adjustments" : "products"
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : ""
  const shown = shownCount(params.show, PAGE_SIZE)

  const where: Prisma.ProductWhereInput = {
    userId: user.id,
    deletedAt: null,
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    }),
  }

  const adjustmentsWhere: Prisma.StockMovementWhereInput = {
    type: "ADJUSTMENT",
    product: { userId: user.id },
  }
  const [total, adjustmentCount] = await Promise.all([
    prisma.product.count({ where }),
    prisma.stockMovement.count({ where: adjustmentsWhere }),
  ])

  // Only the open tab's rows are loaded.
  const [products, adjustments] = await Promise.all([
    tab === "products"
      ? prisma.product.findMany({
          where,
          orderBy: [{ active: "desc" }, { name: "asc" }, { sizeMl: "asc" }],
          take: shown,
        })
      : [],
    tab === "adjustments"
      ? prisma.stockMovement.findMany({
          where: adjustmentsWhere,
          include: { product: { select: { name: true, sizeMl: true } } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: shown,
        })
      : [],
  ])

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
    <UrlTabs
      defaultValue={tab}
      className="flex-1 gap-4"
      tabs={[
        { value: "products", label: "Products", count: total },
        { value: "adjustments", label: "Adjustments", count: adjustmentCount },
      ]}
      actions={{ products: <AddProductDialog verified={verified} /> }}
    >
      <TabsContent value="products" className="flex flex-col gap-4">
        <TableSearch
          defaultValue={q}
          placeholder="Search products"
          label="Search products"
        />
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
            <ProductsTable products={products} verified={verified} />
            <LoadMore
              shown={shown}
              pageSize={PAGE_SIZE}
              total={total}
              params={q ? { q } : undefined}
            />
          </>
        )}
      </TabsContent>

      <TabsContent value="adjustments" className="flex flex-col gap-4">
        {adjustmentCount === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArrowDownUp />
              </EmptyMedia>
              <EmptyTitle>No adjustments yet</EmptyTitle>
              <EmptyDescription>
                When a tester is opened, a bottle breaks or a count is off,
                use Adjust stock in a product&apos;s menu. Every change shows
                here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <AdjustmentsTable adjustments={adjustments} />
            <LoadMore
              shown={shown}
              pageSize={PAGE_SIZE}
              total={adjustmentCount}
              params={{ tab: "adjustments" }}
            />
          </>
        )}
      </TabsContent>
    </UrlTabs>
  )
}
