import type { Metadata } from "next"
import {
  Banknote,
  Boxes,
  ClipboardList,
  HandCoins,
  Landmark,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
} from "lucide-react"

import { VerifyEmailBanner } from "@/components/auth/verify-email-banner"
import { BarList } from "@/components/overview/bar-list"
import { PeriodFilter } from "@/components/overview/period-filter"
import { StatTile } from "@/components/overview/stat-tile"
import { StockHealthChart } from "@/components/overview/stock-health-chart"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/current-user"
import { periodRanges, periods, type Period } from "@/lib/dates"
import { Prisma } from "@/lib/generated/prisma/client"
import { formatCompactMoney, formatCount, formatMoney } from "@/lib/format"
import { readyPreorderIds } from "@/lib/preorders"
import { prisma } from "@/lib/prisma"
import {
  bestSellers,
  businessSummary,
  customerDebts,
  periodFigures,
  stockRemaining,
} from "@/lib/reports"

export const metadata: Metadata = { title: "Overview · Pastelito" }

/** Products with this many units or fewer count as running low. */
const LOW_STOCK = 2
/** Bars in each chart, rows in each list. */
const TOP = 5

const comparedWith: Record<Period, string> = {
  month: "same days last month",
  "6months": "previous 6 months",
  all: "",
}

const units = (count: number) =>
  `${formatCount(count)} ${count === 1 ? "unit" : "units"}`

export default async function OverviewPage({
  searchParams,
}: PageProps<"/">) {
  const user = await requireUser()
  const { period: requested } = await searchParams
  const period = periods.find((value) => value === requested) ?? "month"
  const range = periodRanges(period)

  const [summary, stock, debts, sellers, current, previous, waiting, ready] =
    await Promise.all([
      businessSummary(user.id),
      stockRemaining(user.id),
      customerDebts(user.id),
      bestSellers(user.id),
      periodFigures(user.id, range.current),
      range.previous ? periodFigures(user.id, range.previous) : null,
      prisma.sale.count({ where: { userId: user.id, status: "PREORDER" } }),
      readyPreorderIds(user.id),
    ])

  const stockValue = stock.reduce(
    (sum, product) => sum.add(product.stockValue),
    new Prisma.Decimal(0)
  )
  const stockUnits = stock.reduce(
    (sum, product) => sum + product.quantityOnHand,
    0
  )
  const out = stock.filter((product) => product.quantityOnHand <= 0)
  const low = stock.filter(
    (product) =>
      product.quantityOnHand > 0 && product.quantityOnHand <= LOW_STOCK
  )
  const restock = [...out, ...low].slice(0, TOP)
  const margin = current.revenue.gt(0)
    ? Math.round(current.grossProfit.div(current.revenue).mul(100).toNumber())
    : null
  // A comparison for each period figure, when the period has one before it.
  const compare = (pick: (figures: typeof current) => Prisma.Decimal) =>
    previous
      ? {
          current: pick(current).toNumber(),
          previous: pick(previous).toNumber(),
          period: comparedWith[period],
        }
      : undefined

  return (
    <div className="flex flex-col gap-8">
      {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

      <section className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          What you have
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Cash"
            icon={Banknote}
            value={formatMoney(summary.cash)}
            caption={`${formatCompactMoney(summary.cashFromCapital)} from capital · ${formatCompactMoney(summary.cashFromPayments)} from payments`}
            note={`Capital: ${formatMoney(summary.capitalReceived)} received${summary.capitalRepaid.gt(0) ? `, ${formatMoney(summary.capitalRepaid)} repaid` : ""}, ${formatMoney(summary.capitalUsed)} used on purchases and expenses. Payments: ${formatMoney(summary.paymentsReceived)} received from customers. Spending comes out of capital first.`}
            href="/capital"
          />
          <StatTile
            label="Unsold stock"
            icon={Boxes}
            value={formatCount(stockUnits)}
            caption={`${stockUnits === 1 ? "unit" : "units"} · ${formatCompactMoney(stockValue)} at cost`}
            note={`Units on hand across your products, worth ${formatMoney(stockValue)} at what they cost you.`}
            href="/products"
          />
          <StatTile
            label="Customer debts"
            icon={ReceiptText}
            value={formatMoney(summary.customerDebt)}
            caption={`${formatCount(debts.length)} ${debts.length === 1 ? "customer" : "customers"}`}
            note={
              debts.length === 0
                ? "Nobody owes you."
                : `Unpaid balances of ${debts.length} ${debts.length === 1 ? "customer" : "customers"}.`
            }
            href="/customers"
          />
          <StatTile
            label="Capital owed"
            icon={Landmark}
            value={formatMoney(summary.capitalOwed)}
            caption={`${formatCompactMoney(summary.capitalReceived)} received · ${formatCompactMoney(summary.capitalRepaid)} repaid`}
            note="Still to repay to owners, investors and lenders."
            href="/capital"
          />
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Sales and profit
          </h2>
          <PeriodFilter value={period} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Sales"
            icon={ShoppingCart}
            value={formatMoney(current.revenue)}
            caption={`${formatCount(current.sales)} ${current.sales === 1 ? "sale" : "sales"}`}
            note={`${formatCount(current.sales)} ${current.sales === 1 ? "sale" : "sales"}, including delivered preorders.`}
            compare={compare((figures) => figures.revenue)}
            href="/sales"
          />
          <StatTile
            label="Gross profit"
            icon={TrendingUp}
            value={formatMoney(current.grossProfit)}
            caption={margin === null ? "No sales yet" : `${margin}% margin`}
            note={
              margin === null
                ? "Sales minus what the stock cost you."
                : `Sales minus what the stock cost you: ${margin}% of sales.`
            }
            compare={compare((figures) => figures.grossProfit)}
          />
          <StatTile
            label="Collected"
            icon={HandCoins}
            value={formatMoney(current.collected)}
            caption={`${formatCount(current.payments)} ${current.payments === 1 ? "payment" : "payments"}`}
            note="Payments and preorder deposits received."
            compare={compare((figures) => figures.collected)}
          />
          <StatTile
            label="Preorders waiting"
            icon={ClipboardList}
            value={formatCount(waiting)}
            caption={`${formatCount(ready.size)} ready to deliver`}
            note={
              waiting === 0
                ? "No one is waiting. This doesn't depend on the period."
                : `${formatCount(ready.size)} can be delivered from stock now. This doesn't depend on the period.`
            }
            href="/preorders"
          />
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Needs attention
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Who owes you</CardTitle>
              <CardDescription>
                Largest unpaid balances. Open one to see the customer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {debts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nobody owes you money.
                </p>
              ) : (
                <BarList
                  color="var(--chart-1)"
                  rows={debts.slice(0, TOP).map((debt) => ({
                    key: debt.customerId ?? "walk-in",
                    label: debt.name,
                    value: debt.owed.toNumber(),
                    display: formatMoney(debt.owed),
                    href: debt.customerId
                      ? `/customers/${debt.customerId}`
                      : undefined,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock health</CardTitle>
              <CardDescription>
                Running low means {LOW_STOCK} or fewer left.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {stock.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add products to see their stock.
                </p>
              ) : (
                <>
                  <StockHealthChart
                    counts={{
                      inStock: stock.length - out.length - low.length,
                      low: low.length,
                      out: out.length,
                    }}
                  />
                  {restock.length > 0 && (
                    <ul className="grid gap-2 border-t pt-4 text-sm">
                      {restock.map((product) => (
                        <li
                          key={product.productId}
                          className="flex items-center justify-between gap-4"
                        >
                          <span className="min-w-0 font-medium break-words">
                            {product.name} {formatCount(product.sizeMl)} ml
                          </span>
                          {product.quantityOnHand <= 0 ? (
                            <Badge variant="destructive">Out of stock</Badge>
                          ) : (
                            <Badge variant="outline">
                              {units(product.quantityOnHand)} left
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Best sellers</CardTitle>
              <CardDescription>Most units sold, all time.</CardDescription>
            </CardHeader>
            <CardContent>
              {sellers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sales will show your best sellers here.
                </p>
              ) : (
                <BarList
                  color="var(--chart-2)"
                  rows={sellers.slice(0, TOP).map((seller) => ({
                    key: seller.productId,
                    label: `${seller.name} ${formatCount(seller.sizeMl)} ml`,
                    detail: formatMoney(seller.revenue),
                    value: seller.units,
                    display: units(seller.units),
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
