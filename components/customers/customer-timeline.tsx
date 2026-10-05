import {
  ClipboardList,
  HandCoins,
  PackageCheck,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react"

import { ShowMoreList } from "@/components/show-more-list"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/dates"
import type { Prisma } from "@/lib/generated/prisma/client"
import { formatCount, formatMoney } from "@/lib/format"
import { paymentMethodLabels } from "@/lib/labels"

export type TimelineSale = Prisma.SaleGetPayload<{
  include: {
    payments: true
    items: { include: { product: { select: { name: true; sizeMl: true } } } }
  }
}>

type Kind = "preorder" | "sale" | "delivered" | "payment"

type Event = {
  key: string
  kind: Kind
  date: Date
  title: string
  detail: string
  amount: Prisma.Decimal
  badge?: { label: string; muted?: boolean }
}

const icons: Record<Kind, LucideIcon> = {
  preorder: ClipboardList,
  sale: ShoppingCart,
  delivered: PackageCheck,
  payment: HandCoins,
}

// Same-day events in the order they happen: ordered, sold, then paid.
const rank: Record<Kind, number> = {
  preorder: 0,
  sale: 1,
  delivered: 1,
  payment: 2,
}

const preorderStatus = {
  PREORDER: { label: "Waiting" },
  COMPLETED: { label: "Delivered" },
  CANCELLED: { label: "Cancelled", muted: true },
  DRAFT: { label: "Draft", muted: true },
} as const

function itemsLine(sale: TimelineSale) {
  return sale.items
    .map(
      (item) =>
        `${item.product.name} ${formatCount(item.product.sizeMl)} ml × ${formatCount(item.quantity)}`
    )
    .join(", ")
}

/** Every sale, preorder and payment for one customer, newest first. */
function timelineEvents(sales: TimelineSale[]) {
  const events: Event[] = []
  for (const sale of sales) {
    const items = itemsLine(sale)
    // Only preorders get an order date; cancelled sales were preorders too.
    const preorder = sale.orderedAt !== null || sale.status !== "COMPLETED"
    if (preorder) {
      events.push({
        key: `${sale.id}-ordered`,
        kind: "preorder",
        date: sale.orderedAt ?? sale.date,
        title: "Preordered",
        detail: items,
        amount: sale.total,
        badge: preorderStatus[sale.status],
      })
    }
    if (sale.status === "COMPLETED") {
      events.push({
        key: `${sale.id}-sold`,
        kind: preorder ? "delivered" : "sale",
        date: sale.date,
        title: preorder ? "Delivered" : "Bought",
        detail: items,
        amount: sale.total,
      })
    }
    for (const payment of sale.payments) {
      // Paid before the preorder went out, or while it still waits.
      const deposit =
        preorder &&
        (sale.status !== "COMPLETED" || payment.paidAt < sale.date)
      events.push({
        key: payment.id,
        kind: "payment",
        date: payment.paidAt,
        title: deposit ? "Deposit" : "Paid",
        detail: `${paymentMethodLabels[payment.method]} · ${items}`,
        amount: payment.amount,
        badge:
          sale.status === "CANCELLED"
            ? { label: "Refunded", muted: true }
            : undefined,
      })
    }
  }
  return events.sort(
    (a, b) =>
      b.date.getTime() - a.date.getTime() || rank[b.kind] - rank[a.kind]
  )
}

export function CustomerTimeline({ sales }: { sales: TimelineSale[] }) {
  const events = timelineEvents(sales)

  return (
    <ShowMoreList
      className="grid gap-6 border-s ps-6 ms-4"
      items={events.map((event) => {
        const Icon = icons[event.kind]
        return (
          <li key={event.key} className="relative">
            <span className="absolute -start-10 flex size-8 items-center justify-center rounded-full border bg-background">
              <Icon className="size-4 text-muted-foreground" />
            </span>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div className="grid gap-0.5">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {event.title}
                  {event.badge && (
                    <Badge
                      variant={event.badge.muted ? "outline" : "secondary"}
                      className={
                        event.badge.muted ? "text-muted-foreground" : undefined
                      }
                    >
                      {event.badge.label}
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(event.date)}
                </p>
                <p className="text-sm text-muted-foreground">{event.detail}</p>
              </div>
              <p className="text-sm font-medium tabular-nums">
                {formatMoney(event.amount)}
              </p>
            </div>
          </li>
        )
      })}
    />
  )
}
