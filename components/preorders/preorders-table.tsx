import { PreorderActions } from "@/components/preorders/preorder-actions"
import { RecordPaymentDialog } from "@/components/sales/record-payment-dialog"
import { SaleDetailsDialog } from "@/components/sales/sale-details-dialog"
import {
  itemsSummary,
  toSaleDetails,
  type SaleRow,
} from "@/components/sales/sales-table"
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
import { formatMoney } from "@/lib/format"

export function PreordersTable({
  preorders,
  verified,
  today,
}: {
  preorders: SaleRow[]
  verified: boolean
  today: string
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Ordered</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Deposit</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead className="pr-4">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preorders.map((preorder) => {
            const paid = preorder.payments.reduce(
              (sum, payment) => sum.add(payment.amount),
              new Prisma.Decimal(0)
            )
            const balance = preorder.total.sub(paid)
            const owed = balance.gt(0)
            // A preorder always has a customer.
            const customer = preorder.customer?.name ?? "Unknown customer"
            return (
              <TableRow key={preorder.id}>
                <TableCell className="pl-4">
                  {formatDate(preorder.date)}
                </TableCell>
                <TableCell className="font-medium">{customer}</TableCell>
                <TableCell>
                  <span className="block max-w-72 truncate">
                    {itemsSummary(preorder)}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(preorder.total)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {paid.gt(0) ? (
                    formatMoney(paid)
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell>
                  {owed ? (
                    <span className="tabular-nums">{formatMoney(balance)}</span>
                  ) : (
                    <Badge variant="outline">Paid</Badge>
                  )}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex items-center justify-end gap-2">
                    {owed && (
                      <RecordPaymentDialog
                        verified={verified}
                        today={today}
                        customer={customer}
                        sale={{
                          id: preorder.id,
                          balance: formatMoney(balance),
                          balanceAmount: balance.toNumber(),
                        }}
                      />
                    )}
                    <SaleDetailsDialog
                      preorder
                      verified={verified}
                      today={today}
                      sale={toSaleDetails(preorder)}
                    />
                    <PreorderActions
                      saleId={preorder.id}
                      customer={customer}
                      balance={owed ? formatMoney(balance) : null}
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
