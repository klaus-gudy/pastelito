import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  HandCoins,
  History,
  Mail,
  Phone,
  ShoppingCart,
} from "lucide-react"

import { CustomerActions } from "@/components/customers/customer-actions"
import { CustomerPaymentsTable } from "@/components/customers/customer-payments-table"
import { CustomerTimeline } from "@/components/customers/customer-timeline"
import { NewSaleDialog } from "@/components/sales/new-sale-dialog"
import { SalesTable } from "@/components/sales/sales-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
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
import { formatCount, formatMoney, formatPhone } from "@/lib/format"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Customer · Pastelito" }

const ZERO = new Prisma.Decimal(0)

const tabs = ["history", "purchases", "payments"] as const

export default async function CustomerPage({
  params,
  searchParams,
}: PageProps<"/customers/[id]">) {
  const user = await requireUser()
  const { id } = await params
  const { tab: requestedTab } = await searchParams
  const tab = tabs.find((value) => value === requestedTab) ?? "history"

  const customer = await prisma.customer.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  })
  if (!customer) notFound()

  const verified = Boolean(user.emailVerified)
  const [sales, products] = await Promise.all([
    prisma.sale.findMany({
      where: { userId: user.id, customerId: customer.id, status: { not: "DRAFT" } },
      include: {
        customer: { select: { name: true } },
        payments: { orderBy: { paidAt: "asc" } },
        items: { include: { product: { select: { name: true, sizeMl: true } } } },
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
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
  ])

  const completed = sales.filter((sale) => sale.status === "COMPLETED")
  const sum = (amounts: Prisma.Decimal[]) =>
    amounts.reduce((total, amount) => total.add(amount), ZERO)
  const bought = sum(completed.map((sale) => sale.total))
  const paid = sum(
    completed.flatMap((sale) => sale.payments.map((payment) => payment.amount))
  )
  const waiting = sales.filter((sale) => sale.status === "PREORDER")
  const deposits = sum(
    waiting.flatMap((sale) => sale.payments.map((payment) => payment.amount))
  )

  const stats = [
    { label: "Purchases", value: formatCount(completed.length) },
    { label: "Total bought", value: formatMoney(bought) },
    { label: "Owes", value: formatMoney(bought.sub(paid)) },
    {
      label: "Preorders waiting",
      value: formatCount(waiting.length),
      note: deposits.gt(0) ? `${formatMoney(deposits)} in deposits` : null,
    },
  ]
  const owner = { id: customer.id, name: customer.name }
  const productOptions = products.map((product) => ({
    id: product.id,
    label: `${product.name} ${formatCount(product.sizeMl)} ml`,
    price: product.sellingPrice.toNumber(),
    stock: product.quantityOnHand,
  }))
  const paymentCount = sales.reduce(
    (count, sale) => count + sale.payments.length,
    0
  )

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link href="/customers">
              <ArrowLeft data-icon="inline-start" />
              Customers
            </Link>
          </Button>
          <h2 className="text-xl font-semibold wrap-anywhere">
            {customer.name}
          </h2>
          <div className="grid gap-1 text-sm text-muted-foreground">
            {customer.phone && (
              <p className="flex items-center gap-2">
                <Phone className="size-4" aria-label="Phone" />
                <span className="tabular-nums">
                  {formatPhone(customer.phone)}
                </span>
              </p>
            )}
            {customer.email && (
              <p className="flex items-center gap-2">
                <Mail className="size-4 shrink-0" aria-label="Email" />
                <span className="min-w-0 wrap-anywhere">{customer.email}</span>
              </p>
            )}
            {!customer.phone && !customer.email && (
              <p>No phone or email saved</p>
            )}
          </div>
        </div>
        <CustomerActions
          verified={verified}
          customer={{
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {stat.value}
              </CardTitle>
              {stat.note && (
                <CardDescription className="text-xs">
                  {stat.note}
                </CardDescription>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>

      <UrlTabs
        defaultValue={tab}
        className="gap-4"
        actions={{
          purchases: products.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <NewSaleDialog
                verified={verified}
                today={todayIso()}
                customers={[]}
                products={productOptions}
                fixedCustomer={owner}
              />
              <NewSaleDialog
                preorder
                triggerVariant="outline"
                verified={verified}
                today={todayIso()}
                customers={[]}
                products={productOptions}
                fixedCustomer={owner}
              />
            </div>
          ),
        }}
        tabs={[
          { value: "history", label: "History" },
          { value: "purchases", label: "Purchases", count: completed.length },
          { value: "payments", label: "Payments", count: paymentCount },
        ]}
      >
        <TabsContent value="history">
          {sales.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <History />
                </EmptyMedia>
                <EmptyTitle>Nothing yet</EmptyTitle>
                <EmptyDescription>
                  Sales, preorders and payments for {customer.name} will show
                  here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <CustomerTimeline sales={sales} />
          )}
        </TabsContent>
        <TabsContent value="purchases">
          {completed.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingCart />
                </EmptyMedia>
                <EmptyTitle>No purchases yet</EmptyTitle>
                <EmptyDescription>
                  Sales to {customer.name}, including delivered preorders,
                  will show here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <SalesTable
              sales={completed}
              verified={verified}
              today={todayIso()}
              showCustomer={false}
            />
          )}
        </TabsContent>
        <TabsContent value="payments">
          {paymentCount === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HandCoins />
                </EmptyMedia>
                <EmptyTitle>No payments yet</EmptyTitle>
                <EmptyDescription>
                  Payments and deposits from {customer.name} will show here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <CustomerPaymentsTable sales={sales} />
          )}
        </TabsContent>
      </UrlTabs>
    </div>
  )
}
