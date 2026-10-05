import { itemsSummary, type SaleRow } from "@/components/sales/sales-table"
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
import { formatMoney } from "@/lib/format"
import { paymentMethodLabels } from "@/lib/labels"

/** Every payment a customer made, newest first, with what it paid for. */
export function CustomerPaymentsTable({ sales }: { sales: SaleRow[] }) {
  const payments = sales
    .flatMap((sale) => sale.payments.map((payment) => ({ payment, sale })))
    .sort((a, b) => b.payment.paidAt.getTime() - a.payment.paidAt.getTime())

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Date</TableHead>
            <TableHead>Paid by</TableHead>
            <TableHead>For</TableHead>
            <TableHead className="pr-4">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map(({ payment, sale }) => (
            <TableRow key={payment.id}>
              <TableCell className="pl-4">
                {formatDate(payment.paidAt)}
              </TableCell>
              <TableCell>{paymentMethodLabels[payment.method]}</TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span className="block max-w-72 truncate">
                    {itemsSummary(sale)}
                  </span>
                  {sale.status === "PREORDER" && (
                    <Badge variant="secondary">Deposit</Badge>
                  )}
                  {/* Payments on cancelled preorders are treated as refunded. */}
                  {sale.status === "CANCELLED" && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Refunded
                    </Badge>
                  )}
                </span>
              </TableCell>
              <TableCell className="pr-4 font-medium tabular-nums">
                {formatMoney(payment.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
