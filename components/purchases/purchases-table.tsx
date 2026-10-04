import { PurchaseDetailsDialog } from "@/components/purchases/purchase-details-dialog"
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

export function PurchasesTable({ purchases }: { purchases: PurchaseRow[] }) {
  return (
    <div className="rounded-lg border">
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
              <TableCell className="font-medium">
                {purchase.supplier?.name ?? "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="max-w-72 truncate">
                    {itemsSummary(purchase)}
                  </span>
                  {purchase.status !== "RECEIVED" && (
                    <Badge variant="outline">
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
                  purchase={{
                    date: formatDate(purchase.date),
                    supplier: purchase.supplier?.name ?? null,
                    method: paymentMethodLabels[purchase.method],
                    note: purchase.note,
                    total: formatMoney(purchase.total),
                    items: purchase.items.map((item) => ({
                      label: productLabel(item.product),
                      quantity: item.quantity,
                      unitCost: formatMoney(item.unitCost),
                      lineTotal: formatMoney(item.lineTotal),
                    })),
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
