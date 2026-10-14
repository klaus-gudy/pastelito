import type { Metadata } from "next"
import { PiggyBank, Receipt, Scale } from "lucide-react"

import { AddExpenseDialog } from "@/components/expenses/expense-dialog"
import { ExpensesTable } from "@/components/expenses/expenses-table"
import { LoadMore } from "@/components/load-more"
import { BarList } from "@/components/overview/bar-list"
import { PeriodFilter } from "@/components/overview/period-filter"
import { StatTile } from "@/components/overview/stat-tile"
import {
  Card,
  CardContent,
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
import { requireUser } from "@/lib/current-user"
import { periodRanges, periods, todayIso, type Period } from "@/lib/dates"
import { formatCount, formatMoney } from "@/lib/format"
import { expenseCategoryLabel } from "@/lib/labels"
import { shownCount } from "@/lib/list-size"
import { prisma } from "@/lib/prisma"
import {
  periodExpenses,
  periodFigures,
  periodWriteOffs,
} from "@/lib/reports"

export const metadata: Metadata = { title: "Expenses · Pastelito" }

const PAGE_SIZE = 10

const comparedWith: Record<Period, string> = {
  month: "same days last month",
  "6months": "previous 6 months",
  all: "",
}

export default async function ExpensesPage({
  searchParams,
}: PageProps<"/expenses">) {
  const user = await requireUser()
  const verified = user.verified
  const today = todayIso()
  const params = await searchParams
  const period = periods.find((value) => value === params.period) ?? "month"
  const range = periodRanges(period)

  const [
    everRecorded,
    spent,
    spentBefore,
    sales,
    salesBefore,
    writeOffs,
    writeOffsBefore,
  ] = await Promise.all([
    prisma.expense.count({ where: { userId: user.id } }),
    periodExpenses(user.id, range.current),
    range.previous ? periodExpenses(user.id, range.previous) : null,
    periodFigures(user.id, range.current),
    range.previous ? periodFigures(user.id, range.previous) : null,
    periodWriteOffs(user.id, range.current),
    range.previous ? periodWriteOffs(user.id, range.previous) : null,
  ])

  const addExpense = <AddExpenseDialog verified={verified} today={today} />

  if (everRecorded === 0) {
    return (
      <Empty className="flex-1 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Receipt />
          </EmptyMedia>
          <EmptyTitle>No expenses yet</EmptyTitle>
          <EmptyDescription>
            Record what running the shop costs, like rent, transport and
            packaging, to see your real profit and keep your cash right.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{addExpense}</EmptyContent>
      </Empty>
    )
  }

  const shown = shownCount(params.show, PAGE_SIZE)
  const expenses = await prisma.expense.findMany({
    where: {
      userId: user.id,
      date: { gte: range.current.from, lt: range.current.to },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: shown,
  })

  const netProfit = sales.grossProfit.sub(spent.total).sub(writeOffs.value)
  const netBefore =
    salesBefore && spentBefore && writeOffsBefore
      ? salesBefore.grossProfit
          .sub(spentBefore.total)
          .sub(writeOffsBefore.value)
      : null
  const hasWriteOffs = !writeOffs.value.isZero()
  const compare = (current: number, previous: number | undefined) =>
    previous === undefined
      ? undefined
      : { current, previous, period: comparedWith[period] }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter value={period} />
        {addExpense}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Expenses"
          icon={Receipt}
          value={formatMoney(spent.total)}
          caption={`${formatCount(spent.count)} ${spent.count === 1 ? "expense" : "expenses"}`}
          note="Money spent running the business. Stock bought is under Purchases."
          compare={compare(
            spent.total.toNumber(),
            spentBefore?.total.toNumber()
          )}
        />
        <StatTile
          label="Gross profit"
          icon={PiggyBank}
          value={formatMoney(sales.grossProfit)}
          caption="Sales minus cost of stock"
          note="What you kept from sales after paying for the stock you sold."
          compare={compare(
            sales.grossProfit.toNumber(),
            salesBefore?.grossProfit.toNumber()
          )}
          href={period === "month" ? "/profit" : `/profit?period=${period}`}
        />
        <StatTile
          label="Net profit"
          icon={Scale}
          value={formatMoney(netProfit)}
          caption={
            hasWriteOffs
              ? `After expenses and ${formatMoney(writeOffs.value)} of stock written off`
              : "Gross profit minus expenses"
          }
          note="What the business earned after paying for the stock sold, its running costs, and stock taken out by adjustments such as testers and breakage. Capital and repayments don't count."
          compare={compare(netProfit.toNumber(), netBefore?.toNumber())}
        />
      </div>

      {spent.count === 0 && !hasWriteOffs ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Receipt />
            </EmptyMedia>
            <EmptyTitle>No expenses in this period</EmptyTitle>
            <EmptyDescription>
              Pick a longer period to see earlier expenses.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)] xl:items-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Where it went</CardTitle>
              <CardDescription>
                {hasWriteOffs
                  ? "Expenses by category, and stock written off."
                  : "Expenses by category."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarList
                color="var(--chart-2)"
                rows={[
                  ...spent.byCategory.map((row) => ({
                    key: row.category,
                    label: expenseCategoryLabel(row.category),
                    value: row.amount.toNumber(),
                    display: formatMoney(row.amount),
                    detail: `${formatCount(row.count)}×`,
                  })),
                  // Stock lost to adjustments, valued at cost.
                  ...(writeOffs.value.gt(0)
                    ? [
                        {
                          key: "stock-written-off",
                          label: "Stock written off",
                          value: writeOffs.value.toNumber(),
                          display: formatMoney(writeOffs.value),
                          detail: `${formatCount(writeOffs.units)} ${writeOffs.units === 1 ? "unit" : "units"}`,
                          href: "/products?tab=adjustments",
                        },
                      ]
                    : []),
                ].sort((a, b) => b.value - a.value)}
              />
            </CardContent>
          </Card>

          {/* A flex column, not a grid, so the wide table scrolls in its own
              box instead of widening the page. */}
          <section className="flex min-w-0 flex-col gap-4">
            {spent.count === 0 ? (
              <p className="text-sm text-muted-foreground">
                No expenses in this period, only stock written off.
              </p>
            ) : (
              <>
                <ExpensesTable
                  expenses={expenses}
                  verified={verified}
                  today={today}
                />
                <LoadMore
                  shown={shown}
                  pageSize={PAGE_SIZE}
                  total={spent.count}
                  params={period === "month" ? undefined : { period }}
                />
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
