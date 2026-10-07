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

/** What the details dialog shows, pre-formatted. */
function toPurchaseDetails(purchase: PurchaseRow): PurchaseDetails {
  return {
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
  }
}

export function PurchasesTable({ purchases }: { purchases: PurchaseRow[] }) {
  return (
    <>
      <div className="hidden rounded-lg border md:block">
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
              description={formatDate(purchase.date)}
              aside={
                <span className="font-medium tabular-nums">
                  {formatMoney(purchase.total)}
                </span>
              }
            />
            <MobileCardFields>
              <MobileCardField label="Items" className="col-span-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{itemsSummary(purchase)}</span>
                  {purchase.status !== "RECEIVED" && (
                    <Badge variant="outline">
                      {purchase.status === "DRAFT" ? "Ordered" : "Cancelled"}
                    </Badge>
                  )}
                </div>
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
