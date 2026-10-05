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
import { overviewItem } from "@/components/dashboard/navigation"
import { ListCard } from "@/components/overview/list-card"
import { StatTile } from "@/components/overview/stat-tile"
import { requireUser } from "@/lib/current-user"
import { monthToDate } from "@/lib/dates"
import { Prisma } from "@/lib/generated/prisma/client"
import { formatCount, formatMoney } from "@/lib/format"
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
/** Rows in each list. */
const TOP = 5

const units = (count: number) =>
  `${formatCount(count)} ${count === 1 ? "unit" : "units"}`

export default async function OverviewPage() {
  const user = await requireUser()
  const firstName = user.name?.split(" ")[0]
  const month = monthToDate()

  const [summary, stock, debts, sellers, thisMonth, lastMonth, waiting, ready] =
    await Promise.all([
      businessSummary(user.id),
      stockRemaining(user.id),
      customerDebts(user.id),
      bestSellers(user.id),
      periodFigures(user.id, month.current),
      periodFigures(user.id, month.previous),
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
  const lowStock = stock
    .filter((product) => product.quantityOnHand <= LOW_STOCK)
    .sort((a, b) => a.quantityOnHand - b.quantityOnHand)
    .slice(0, TOP)
  const margin = thisMonth.revenue.gt(0)
    ? Math.round(
        thisMonth.grossProfit.div(thisMonth.revenue).mul(100).toNumber()
      )
    : null
  const period = "same days last month"

  return (
    <div className="flex flex-col gap-8">
      {!user.emailVerified && <VerifyEmailBanner email={user.email} />}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Hi, ${firstName}` : "Welcome"}
        </h2>
        <p className="mt-1 text-muted-foreground">{overviewItem.question}</p>
      </div>

      <section className="grid gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          What you have
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Cash"
            icon={Banknote}
            value={formatMoney(summary.cash)}
            note="Capital and payments in, minus what you spent"
            href="/capital"
          />
          <StatTile
            label="Unsold stock"
            icon={Boxes}
            value={formatMoney(stockValue)}
            note={`${units(stockUnits)} at what they cost you`}
            href="/products"
          />
          <StatTile
            label="Customer debts"
            icon={ReceiptText}
            value={formatMoney(summary.customerDebt)}
            note={
              debts.length === 0
                ? "Nobody owes you"
                : `Owed by ${debts.length} ${debts.length === 1 ? "customer" : "customers"}`
            }
            href="/customers"
          />
          <StatTile
            label="Capital owed"
            icon={Landmark}
            value={formatMoney(summary.capitalOwed)}
            note="Still to repay to owners, investors and lenders"
            href="/capital"
          />
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          This month so far
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Sales"
            icon={ShoppingCart}
            value={formatMoney(thisMonth.revenue)}
            note={`${formatCount(thisMonth.sales)} ${thisMonth.sales === 1 ? "sale" : "sales"}`}
            compare={{
              current: thisMonth.revenue.toNumber(),
              previous: lastMonth.revenue.toNumber(),
              period,
            }}
            href="/sales"
          />
          <StatTile
            label="Gross profit"
            icon={TrendingUp}
            value={formatMoney(thisMonth.grossProfit)}
            note={
              margin === null
                ? "Sales minus what the stock cost"
                : `${margin}% of sales`
            }
            compare={{
              current: thisMonth.grossProfit.toNumber(),
              previous: lastMonth.grossProfit.toNumber(),
              period,
            }}
          />
          <StatTile
            label="Collected"
            icon={HandCoins}
            value={formatMoney(thisMonth.collected)}
            note="Payments and deposits received"
            compare={{
              current: thisMonth.collected.toNumber(),
              previous: lastMonth.collected.toNumber(),
              period,
            }}
          />
          <StatTile
            label="Preorders waiting"
            icon={ClipboardList}
            value={formatCount(waiting)}
            note={
              waiting === 0
                ? "No one is waiting"
                : `${formatCount(ready.size)} ready to deliver`
            }
            href="/preorders"
          />
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Needs attention
        </h3>
        <div className="grid gap-4 lg:grid-cols-3">
          <ListCard
            title="Who owes you"
            description="Largest unpaid balances"
            empty="Nobody owes you money."
            rows={debts.slice(0, TOP).map((debt) => ({
              key: debt.customerId ?? "walk-in",
              label: debt.name,
              value: formatMoney(debt.owed),
              href: debt.customerId
                ? `/customers/${debt.customerId}`
                : undefined,
            }))}
          />
          <ListCard
            title="Running low"
            description={`Products with ${LOW_STOCK} or fewer in stock`}
            empty="Every product has stock."
            rows={lowStock.map((product) => ({
              key: product.productId,
              label: `${product.name} ${formatCount(product.sizeMl)} ml`,
              value:
                product.quantityOnHand <= 0
                  ? "Out of stock"
                  : `${units(product.quantityOnHand)} left`,
            }))}
          />
          <ListCard
            title="Best sellers"
            description="Most units sold, all time"
            empty="Sales will show your best sellers here."
            rows={sellers.slice(0, TOP).map((seller) => ({
              key: seller.productId,
              label: `${seller.name} ${formatCount(seller.sizeMl)} ml`,
              detail: formatMoney(seller.revenue),
              value: units(seller.units),
            }))}
          />
        </div>
      </section>
    </div>
  )
}
