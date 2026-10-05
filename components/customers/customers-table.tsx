import Link from "next/link"
import { Eye } from "lucide-react"

import { EditCustomerDialog } from "@/components/customers/add-customer-dialog"
import { SortHeader, type SortDirection } from "@/components/sort-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

export const customerSortColumns = ["purchases"] as const

export function CustomersTable({
  customers,
  sort,
  q,
  verified,
}: {
  customers: CustomerRow[]
  sort: { column: string; direction: SortDirection } | null
  /** The search, kept when sorting. */
  q: string
  verified: boolean
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>
              <SortHeader
                path="/customers"
                label="Purchases"
                column="purchases"
                sort={sort}
                params={q ? { q } : undefined}
              />
            </TableHead>
            <TableHead>Owes</TableHead>
            <TableHead>Last purchase</TableHead>
            <TableHead className="pr-4">
              <span className="sr-only">Actions</span>
            </TableHead>
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
              <TableCell>
                {customer.lastPurchase ? formatDate(customer.lastPurchase) : "—"}
              </TableCell>
              <TableCell className="pr-4">
                <div className="flex items-center justify-end gap-2">
                  <EditCustomerDialog
                    compact
                    verified={verified}
                    customer={{
                      id: customer.id,
                      name: customer.name,
                      phone: customer.phone,
                      email: customer.email,
                    }}
                  />
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/customers/${customer.id}`}>
                      <Eye data-icon="inline-start" />
                      View
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
