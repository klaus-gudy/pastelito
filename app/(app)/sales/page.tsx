import type { Metadata } from "next"
import Link from "next/link"
import { Package, ShoppingCart } from "lucide-react"

import { NewSaleDialog } from "@/components/sales/new-sale-dialog"
import { SalesTable } from "@/components/sales/sales-table"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { requireUser } from "@/lib/current-user"
import { todayIso } from "@/lib/dates"
import { formatCount } from "@/lib/format"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Sales · Pastelito" }

const PAGE_SIZE = 10

export default async function SalesPage({
  searchParams,
}: PageProps<"/sales">) {
  const user = await requireUser()
  const verified = Boolean(user.emailVerified)

  const params = await searchParams
  const requestedPage = Number(params.page)
  // Preorders have their own page; this lists sales that have happened.
  const where = { userId: user.id, status: "COMPLETED" } as const

  const [products, customers, total] = await Promise.all([
    prisma.product.findMany({
      where: { userId: user.id, active: true },
      orderBy: [{ name: "asc" }, { sizeMl: "asc" }],
      select: {
        id: true,
        name: true,
        sizeMl: true,
        sellingPrice: true,
        quantityOnHand: true,
      },
    }),
    prisma.customer.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.sale.count({ where }),
  ])

  if (products.length === 0 && total === 0) {
    return (
      <Empty className="flex-1 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Package />
          </EmptyMedia>
          <EmptyTitle>Add products first</EmptyTitle>
          <EmptyDescription>
            A sale takes stock off your products, so add the perfumes you sell
            before recording what you sold.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/products">Go to products</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const newSale = (
    <NewSaleDialog
      verified={verified}
      today={todayIso()}
      customers={customers}
      products={products.map((product) => ({
        id: product.id,
        label: `${product.name} ${formatCount(product.sizeMl)} ml`,
        price: product.sellingPrice.toNumber(),
        stock: product.quantityOnHand,
      }))}
    />
  )

  if (total === 0) {
    return (
      <Empty className="flex-1 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingCart />
          </EmptyMedia>
          <EmptyTitle>No sales yet</EmptyTitle>
          <EmptyDescription>
            Record what you sell to see your revenue, profit and who still owes
            you.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{newSale}</EmptyContent>
      </Empty>
    )
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Number.isInteger(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), pageCount)
    : 1
  const sales = await prisma.sale.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      payments: { orderBy: { paidAt: "asc" } },
      items: { include: { product: { select: { name: true, sizeMl: true } } } },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex justify-end">{newSale}</div>
      <SalesTable sales={sales} verified={verified} today={todayIso()} />
      <TablePagination page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  )
}
