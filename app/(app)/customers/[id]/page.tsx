import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, History } from "lucide-react"

import { CustomerTimeline } from "@/components/customers/customer-timeline"
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
import { requireUser } from "@/lib/current-user"
import { Prisma } from "@/lib/generated/prisma/client"
import { formatCount, formatMoney, formatPhone } from "@/lib/format"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Customer · Pastelito" }

const ZERO = new Prisma.Decimal(0)

export default async function CustomerPage({
  params,
}: PageProps<"/customers/[id]">) {
  const user = await requireUser()
  const { id } = await params

  const customer = await prisma.customer.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  })
  if (!customer) notFound()

  const sales = await prisma.sale.findMany({
    where: { userId: user.id, customerId: customer.id, status: { not: "DRAFT" } },
    include: {
      payments: { orderBy: { paidAt: "asc" } },
      items: { include: { product: { select: { name: true, sizeMl: true } } } },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  })

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
  const contact = [
    customer.phone && formatPhone(customer.phone),
    customer.email,
  ].filter(Boolean)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link href="/customers">
              <ArrowLeft data-icon="inline-start" />
              Customers
            </Link>
          </Button>
          <h2 className="text-xl font-semibold">{customer.name}</h2>
          <p className="text-sm text-muted-foreground">
            {contact.length > 0 ? contact.join(" · ") : "No phone or email saved"}
          </p>
        </div>
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

      <section className="grid gap-4">
        <h3 className="text-sm font-medium">History</h3>
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
      </section>
    </div>
  )
}
