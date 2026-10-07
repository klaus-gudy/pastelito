import type { Metadata } from "next"
import { Boxes, Percent, PiggyBank, ShoppingCart } from "lucide-react"

import { LoadMore } from "@/components/load-more"
import { PeriodFilter } from "@/components/overview/period-filter"
import { StatTile } from "@/components/overview/stat-tile"
import { ProfitTable } from "@/components/profit/profit-table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { requireUser } from "@/lib/current-user"
import { periodRanges, periods, type Period } from "@/lib/dates"
import { formatCount, formatMoney } from "@/lib/format"
import { shownCount } from "@/lib/list-size"
import { prisma } from "@/lib/prisma"
import { periodFigures } from "@/lib/reports"

export const metadata: Metadata = { title: "Profit · Pastelito" }

const PAGE_SIZE = 10

const comparedWith: Record<Period, string> = {
  month: "same days last month",
  "6months": "previous 6 months",
  all: "",
}

export default async function ProfitPage({
  searchParams,
}: PageProps<"/profit">) {
  const user = await requireUser()
  const params = await searchParams
  const period = periods.find((value) => value === params.period) ?? "month"
  const range = periodRanges(period)
  const where = {
    userId: user.id,
    status: "COMPLETED",
    date: { gte: range.current.from, lt: range.current.to },
  } as const

  const [current, previous, total] = await Promise.all([
    periodFigures(user.id, range.current),
    range.previous ? periodFigures(user.id, range.previous) : null,
    prisma.sale.count({ where }),
  ])

  const shown = shownCount(params.show, PAGE_SIZE)
  const sales = await prisma.sale.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      payments: true,
      items: { include: { product: { select: { name: true, sizeMl: true } } } },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: shown,
  })

  const cost = current.revenue.sub(current.grossProfit)
  const margin = current.revenue.gt(0)
    ? Math.round(current.grossProfit.div(current.revenue).mul(100).toNumber())
    : null
  const compare = (pick: (figures: typeof current) => number) =>
    previous
      ? {
          current: pick(current),
          previous: pick(previous),
          period: comparedWith[period],
        }
      : undefined

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PeriodFilter value={period} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Sales"
          icon={ShoppingCart}
          value={formatMoney(current.revenue)}
          caption={`${formatCount(current.sales)} ${current.sales === 1 ? "sale" : "sales"}`}
          note="What customers were charged, after discounts, including delivered preorders."
          compare={compare((figures) => figures.revenue.toNumber())}
        />
        <StatTile
          label="Cost of stock sold"
          icon={Boxes}
          value={formatMoney(cost)}
          caption={`${formatCount(current.unitsSold)} ${current.unitsSold === 1 ? "unit" : "units"}`}
          note="What the units sold cost you, at their average buying cost when sold."
          compare={compare((figures) =>
            figures.revenue.sub(figures.grossProfit).toNumber()
          )}
        />
        <StatTile
          label="Gross profit"
          icon={PiggyBank}
          value={formatMoney(current.grossProfit)}
          caption="Sales minus cost of stock"
          note="What you keep from sales after paying for the stock you sold."
          compare={compare((figures) => figures.grossProfit.toNumber())}
        />
        <StatTile
          label="Margin"
          icon={Percent}
          value={margin === null ? "—" : `${margin}%`}
          caption="Of every shilling sold"
          note="Gross profit as a share of sales: how much of each sale you keep after paying for the stock."
        />
      </div>

      {/* A flex column, not a grid, so the wide table scrolls in its own
          box instead of widening the page. */}
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Profit per sale
        </h2>
        {total === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PiggyBank />
              </EmptyMedia>
              <EmptyTitle>No sales in this period</EmptyTitle>
              <EmptyDescription>
                Each sale shows here with what it cost you and what it earned.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <ProfitTable sales={sales} />
            <LoadMore
              shown={shown}
              pageSize={PAGE_SIZE}
              total={total}
              params={period === "month" ? undefined : { period }}
            />
          </>
        )}
      </section>
    </div>
  )
}
