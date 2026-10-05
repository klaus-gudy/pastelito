import { RecordPaymentDialog } from "@/components/sales/record-payment-dialog"
import {
  SaleDetailsDialog,
  type SaleDetails,
} from "@/components/sales/sale-details-dialog"
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
import { Prisma } from "@/lib/generated/prisma/client"
import { formatCount, formatMoney } from "@/lib/format"
import { paymentMethodLabels } from "@/lib/labels"

export type SaleRow = Prisma.SaleGetPayload<{
  include: {
    customer: { select: { name: true } }
    payments: true
    items: { include: { product: { select: { name: true; sizeMl: true } } } }
  }
}>

export const productLabel = (product: { name: string; sizeMl: number }) =>
  `${product.name} ${formatCount(product.sizeMl)} ml`

export function itemsSummary(sale: SaleRow) {
  const [first, ...rest] = sale.items
  if (!first) return "—"
  const head = `${productLabel(first.product)} × ${formatCount(first.quantity)}`
  return rest.length ? `${head}, +${rest.length} more` : head
}

/** What the details dialog shows, pre-formatted. */
export function toSaleDetails(sale: SaleRow): SaleDetails {
  const paid = sale.payments.reduce(
    (sum, payment) => sum.add(payment.amount),
    new Prisma.Decimal(0)
  )
  const balance = sale.total.sub(paid)
  const owed = balance.gt(0)
  return {
    id: sale.id,
    date: formatDate(sale.date),
    orderedOn:
      sale.status === "COMPLETED" && sale.orderedAt
        ? formatDate(sale.orderedAt)
        : null,
    customer: sale.customer?.name ?? null,
    note: sale.note,
    subtotal: formatMoney(sale.total.add(sale.discount)),
    discount: sale.discount.gt(0) ? formatMoney(sale.discount) : null,
    total: formatMoney(sale.total),
    paid: formatMoney(paid),
    balance: owed ? formatMoney(balance) : null,
    balanceAmount: balance.toNumber(),
    items: sale.items.map((item) => ({
      key: item.id,
      label: productLabel(item.product),
      brand: item.brand,
      quantity: item.quantity,
      unitPrice: formatMoney(item.unitPrice),
      lineTotal: formatMoney(item.lineTotal),
    })),
    payments: sale.payments.map((payment) => ({
      key: payment.id,
      date: formatDate(payment.paidAt),
      method: paymentMethodLabels[payment.method],
      amount: formatMoney(payment.amount),
    })),
  }
}

export function SalesTable({
  sales,
  verified,
  today,
}: {
  sales: SaleRow[]
  verified: boolean
  today: string
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead className="pr-4">
              <span className="sr-only">Details</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => {
            const paid = sale.payments.reduce(
              (sum, payment) => sum.add(payment.amount),
              new Prisma.Decimal(0)
            )
            const balance = sale.total.sub(paid)
            const owed = balance.gt(0)
            return (
              <TableRow key={sale.id}>
                <TableCell className="pl-4">{formatDate(sale.date)}</TableCell>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {sale.customer?.name ?? (
                      <span className="font-normal text-muted-foreground">
                        Walk-in
                      </span>
                    )}
                    {/* Only preorders get an order date. */}
                    {sale.orderedAt && (
                      <Badge
                        variant="secondary"
                        title={`Preordered ${formatDate(sale.orderedAt)}`}
                      >
                        Preorder
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="block max-w-72 truncate">
                    {itemsSummary(sale)}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(sale.total)}
                </TableCell>
                <TableCell>
                  {owed ? (
                    <span className="tabular-nums">{formatMoney(balance)}</span>
                  ) : (
                    <Badge variant="outline">Paid</Badge>
                  )}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-2">
                    {owed && (
                      <RecordPaymentDialog
                        verified={verified}
                        today={today}
                        customer={sale.customer?.name ?? null}
                        sale={{
                          id: sale.id,
                          balance: formatMoney(balance),
                          balanceAmount: balance.toNumber(),
                        }}
                      />
                    )}
                    <SaleDetailsDialog
                      verified={verified}
                      today={today}
                      sale={toSaleDetails(sale)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
