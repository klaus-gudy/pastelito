import type { Metadata } from "next"
import Link from "next/link"
import { Package, ShoppingBag, Truck } from "lucide-react"

import { AddSupplierDialog } from "@/components/purchases/add-supplier-dialog"
import { NewPurchaseDialog } from "@/components/purchases/new-purchase-dialog"
import { PurchasesTable } from "@/components/purchases/purchases-table"
import {
  SuppliersTable,
  type SupplierRow,
} from "@/components/purchases/suppliers-table"
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
import { TabsContent } from "@/components/ui/tabs"
import { UrlTabs } from "@/components/url-tabs"
import { requireUser } from "@/lib/current-user"
import { todayIso } from "@/lib/dates"
import { Prisma } from "@/lib/generated/prisma/client"
import { formatCount } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import { businessSummary } from "@/lib/reports"

export const metadata: Metadata = { title: "Purchases · Pastelito" }

const PAGE_SIZE = 10

export default async function PurchasesPage({
  searchParams,
}: PageProps<"/purchases">) {
  const user = await requireUser()
  const verified = Boolean(user.emailVerified)
  const today = todayIso()

  const params = await searchParams
  const tab = params.tab === "suppliers" ? "suppliers" : "purchases"
  const requestedPage = Number(params.page)

  const [products, suppliers, supplierTotals, purchaseCount, summary] =
    await Promise.all([
      prisma.product.findMany({
        where: { userId: user.id, active: true },
        orderBy: [{ name: "asc" }, { sizeMl: "asc" }],
        select: { id: true, name: true, sizeMl: true, avgCost: true },
      }),
      prisma.supplier.findMany({
        where: { userId: user.id },
        orderBy: { name: "asc" },
      }),
      prisma.purchase.groupBy({
        by: ["supplierId"],
        where: { userId: user.id, status: "RECEIVED" },
        _count: true,
        _sum: { total: true },
        _max: { date: true },
      }),
      prisma.purchase.count({ where: { userId: user.id } }),
      businessSummary(user.id),
    ])

  const pageCount = Math.max(1, Math.ceil(purchaseCount / PAGE_SIZE))
  const page = Number.isInteger(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), pageCount)
    : 1
  const purchases = await prisma.purchase.findMany({
    where: { userId: user.id },
    include: {
      supplier: { select: { name: true } },
      items: { include: { product: { select: { name: true, sizeMl: true } } } },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  const supplierRows: SupplierRow[] = suppliers.map((supplier) => {
    const totals = supplierTotals.find((row) => row.supplierId === supplier.id)
    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      purchases: totals?._count ?? 0,
      spent: totals?._sum.total ?? new Prisma.Decimal(0),
      lastPurchase: totals?._max.date ?? null,
    }
  })

  const newPurchase = products.length > 0 && (
    <NewPurchaseDialog
      verified={verified}
      today={today}
      availableCash={summary.cash.toNumber()}
      suppliers={suppliers.map((supplier) => supplier.name)}
      products={products.map((product) => ({
        id: product.id,
        label: `${product.name} ${formatCount(product.sizeMl)} ml`,
        lastCost: product.avgCost.gt(0)
          ? product.avgCost.toDecimalPlaces(0).toNumber()
          : null,
      }))}
    />
  )

  return (
    <UrlTabs
      defaultValue={tab}
      className="flex-1 gap-4"
      tabs={[
        { value: "purchases", label: "Purchases", count: purchaseCount },
        { value: "suppliers", label: "Suppliers", count: suppliers.length },
      ]}
      actions={{
        purchases: purchaseCount > 0 ? newPurchase : null,
        suppliers: <AddSupplierDialog verified={verified} />,
      }}
    >
      <TabsContent value="purchases" className="flex flex-col gap-4">
        {products.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package />
              </EmptyMedia>
              <EmptyTitle>Add products first</EmptyTitle>
              <EmptyDescription>
                A purchase adds stock to your products, so add the perfumes you
                sell before recording what you bought.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/products">Go to products</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : purchaseCount === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShoppingBag />
              </EmptyMedia>
              <EmptyTitle>No purchases yet</EmptyTitle>
              <EmptyDescription>
                Record the stock you buy to keep track of what it cost and
                who you bought it from.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>{newPurchase}</EmptyContent>
          </Empty>
        ) : (
          <>
            <PurchasesTable purchases={purchases} />
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={purchaseCount}
            />
          </>
        )}
      </TabsContent>

      <TabsContent value="suppliers">
        {suppliers.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Truck />
              </EmptyMedia>
              <EmptyTitle>No suppliers yet</EmptyTitle>
              <EmptyDescription>
                Suppliers are added automatically when you type a new name on a
                purchase, or add one here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <SuppliersTable suppliers={supplierRows} />
        )}
      </TabsContent>
    </UrlTabs>
  )
}
