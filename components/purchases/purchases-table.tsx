import {
  MobileCard,
  MobileCardActions,
  MobileCardField,
  MobileCardFields,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards"
import {
  PurchaseDetailsDialog,
  type PurchaseDetails,
} from "@/components/purchases/purchase-details-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/dates"
import type { Prisma } from "@/lib/generated/prisma/client"
import { formatCount, formatMoney } from "@/lib/format"
import { paymentMethodLabels } from "@/lib/labels"

export type PurchaseRow = Prisma.PurchaseGetPayload<{
  include: {
    supplier: { select: { name: true } }
    items: { include: { product: { select: { name: true; sizeMl: true } } } }
  }
}>

const productLabel = (product: { name: string; sizeMl: number }) =>
  `${product.name} ${formatCount(product.sizeMl)} ml`

function itemsSummary(purchase: PurchaseRow) {
  const [first, ...rest] = purchase.items
  if (!first) return "—"
  const head = `${productLabel(first.product)} × ${formatCount(first.quantity)}`
  return rest.length ? `${head}, +${rest.length} more` : head
}

const statusLabels = {
  RECEIVED: "Received",
  DRAFT: "Ordered",
  CANCELLED: "Cancelled",
} as const

/**
 * What the details dialog shows, pre-formatted. A purchase is paid in full,
 * in one payment, when it is received; an order isn't paid yet.
 */
function toPurchaseDetails(purchase: PurchaseRow): PurchaseDetails {
  const received = purchase.status === "RECEIVED"
  return {
    date: formatDate(purchase.date),
    supplier: purchase.supplier?.name ?? null,
    status: statusLabels[purchase.status],
    note: purchase.note,
    total: formatMoney(purchase.total),
    payments: received
      ? [
          {
            key: purchase.id,
            date: formatDate(purchase.receivedAt ?? purchase.date),
            method: paymentMethodLabels[purchase.method],
            amount: formatMoney(purchase.total),
          },
        ]
      : [],
    paid: formatMoney(received ? purchase.total : 0),
    owed: received
      ? "Paid in full"
      : purchase.status === "DRAFT"
        ? formatMoney(purchase.total)
        : "Nothing",
    noPayments:
      purchase.status === "DRAFT"
        ? "Nothing paid yet. It's paid in full when the stock arrives."
        : "Nothing paid. This order was cancelled.",
    items: purchase.items.map((item) => ({
      label: productLabel(item.product),
      quantity: item.quantity,
      unitCost: formatMoney(item.unitCost),
      lineTotal: formatMoney(item.lineTotal),
    })),
  }
}

export function PurchasesTable({ purchases }: { purchases: PurchaseRow[] }) {
  return (
    <>
      <div className="hidden rounded-lg border @4xl/main:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid by</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">Details</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((purchase) => (
              <TableRow key={purchase.id}>
                <TableCell className="pl-4">{formatDate(purchase.date)}</TableCell>
                {/* max-w-0 lets these two columns share what's left of the
                    row and cut long text off with an ellipsis. */}
                <TableCell className="w-1/4 max-w-0 font-medium">
                  <span
                    className="block truncate"
                    title={purchase.supplier?.name}
                  >
                    {purchase.supplier?.name ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="w-1/3 max-w-0">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 truncate" title={itemsSummary(purchase)}>
                      {itemsSummary(purchase)}
                    </span>
                    {purchase.status !== "RECEIVED" && (
                      <Badge variant="outline" className="shrink-0">
                        {purchase.status === "DRAFT" ? "Ordered" : "Cancelled"}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(purchase.total)}
                </TableCell>
                <TableCell>{paymentMethodLabels[purchase.method]}</TableCell>
                <TableCell className="pr-4 text-right">
                  <PurchaseDetailsDialog
                    purchase={toPurchaseDetails(purchase)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <MobileCards>
        {purchases.map((purchase) => (
          <MobileCard key={purchase.id}>
            <MobileCardHeader
              title={purchase.supplier?.name ?? "No supplier"}
              badge={
                purchase.status !== "RECEIVED" && (
                  <Badge variant="outline">
                    {purchase.status === "DRAFT" ? "Ordered" : "Cancelled"}
                  </Badge>
                )
              }
              description={formatDate(purchase.date)}
              aside={
                <span className="font-medium tabular-nums">
                  {formatMoney(purchase.total)}
                </span>
              }
            />
            <MobileCardFields>
              <MobileCardField label="Items">
                {itemsSummary(purchase)}
              </MobileCardField>
              <MobileCardField label="Paid by">
                {paymentMethodLabels[purchase.method]}
              </MobileCardField>
            </MobileCardFields>
            <MobileCardActions>
              <PurchaseDetailsDialog purchase={toPurchaseDetails(purchase)} />
            </MobileCardActions>
          </MobileCard>
        ))}
      </MobileCards>
    </>
  )
}
