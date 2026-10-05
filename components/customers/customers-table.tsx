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
import { formatCount, formatMoney, formatPhone } from "@/lib/format"

export type CustomerRow = {
  id: string
  name: string
  phone: string | null
  email: string | null
  purchases: number
  owes: Prisma.Decimal
  lastPurchase: Date | null
}

/** Customers with at least this many completed sales count as returning. */
const RETURNING_AFTER = 2

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Purchases</TableHead>
            <TableHead>Owes</TableHead>
            <TableHead className="pr-4">Last purchase</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className="pl-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{customer.name}</span>
                  {customer.purchases >= RETURNING_AFTER && (
                    <Badge variant="secondary">Returning</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="tabular-nums">
                {customer.phone ? formatPhone(customer.phone) : "—"}
              </TableCell>
              <TableCell>
                {customer.email ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatCount(customer.purchases)}
              </TableCell>
              <TableCell className="tabular-nums">
                {customer.owes.gt(0) ? (
                  <span className="font-medium">
                    {formatMoney(customer.owes)}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="pr-4">
                {customer.lastPurchase ? formatDate(customer.lastPurchase) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
