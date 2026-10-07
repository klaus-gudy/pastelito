import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardList, Package } from "lucide-react"

import { LoadMore } from "@/components/load-more"
import { PreordersTable } from "@/components/preorders/preorders-table"
import { NewSaleDialog } from "@/components/sales/new-sale-dialog"
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
import { shownCount } from "@/lib/list-size"
import { readyPreorderIds } from "@/lib/preorders"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Preorders · Pastelito" }

const PAGE_SIZE = 10

export default async function PreordersPage({
  searchParams,
}: PageProps<"/preorders">) {
  const user = await requireUser()
  const verified = Boolean(user.emailVerified)

  const params = await searchParams
  const shown = shownCount(params.show, PAGE_SIZE)
  // Delivered preorders move to Sales; cancelled ones drop off.
  const where = { userId: user.id, status: "PREORDER" } as const

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
      where: { userId: user.id, deletedAt: null },
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
            A preorder lists the perfumes a customer is waiting for, so add
            the perfumes you sell before taking orders.
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

  const newPreorder = (
    <NewSaleDialog
      preorder
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
            <ClipboardList />
          </EmptyMedia>
          <EmptyTitle>No preorders waiting</EmptyTitle>
          <EmptyDescription>
            Record orders for perfumes you don&apos;t have yet, take deposits,
            and deliver them when the stock arrives.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{newPreorder}</EmptyContent>
      </Empty>
    )
  }

  const [preorders, readyIds] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        payments: { orderBy: { paidAt: "asc" } },
        items: { include: { product: { select: { name: true, sizeMl: true } } } },
      },
      // Oldest first: whoever has waited longest is served first.
      orderBy: [{ date: "asc" }, { id: "asc" }],
      take: shown,
    }),
    readyPreorderIds(user.id),
  ])

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex justify-end">{newPreorder}</div>
      <PreordersTable
        preorders={preorders}
        readyIds={readyIds}
        verified={verified}
        today={todayIso()}
      />
      <LoadMore shown={shown} pageSize={PAGE_SIZE} total={total} />
    </div>
  )
}
