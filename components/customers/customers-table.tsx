import Link from "next/link"
import { Eye } from "lucide-react"

import {
  MobileCard,
  MobileCardActions,
  MobileCardField,
  MobileCardFields,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Prisma } from "@/lib/generated/prisma/client"
import { formatMoney, formatPhone } from "@/lib/format"

export type CustomerRow = {
  id: string
  name: string
  phone: string | null
  email: string | null
  owes: Prisma.Decimal
}

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  return (
    <>
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Owes</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="pl-4 font-medium">{customer.name}</TableCell>
                <TableCell className="tabular-nums">
                  {customer.phone ? formatPhone(customer.phone) : "—"}
                </TableCell>
                <TableCell>
                  {customer.email ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
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
                  <div className="flex justify-end">
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
      <MobileCards>
        {customers.map((customer) => (
          <MobileCard key={customer.id}>
            <MobileCardHeader
              title={customer.name}
              aside={
                customer.owes.gt(0) && (
                  <span className="font-medium tabular-nums">
                    {formatMoney(customer.owes)}
                  </span>
                )
              }
            />
            <MobileCardFields>
              <MobileCardField label="Phone">
                <span className="tabular-nums">
                  {customer.phone ? formatPhone(customer.phone) : "—"}
                </span>
              </MobileCardField>
              <MobileCardField label="Email">
                <span className="block truncate">{customer.email ?? "—"}</span>
              </MobileCardField>
            </MobileCardFields>
            <MobileCardActions>
              <Button asChild variant="outline" size="sm">
                <Link href={`/customers/${customer.id}`}>
                  <Eye data-icon="inline-start" />
                  View
                </Link>
              </Button>
            </MobileCardActions>
          </MobileCard>
        ))}
      </MobileCards>
    </>
  )
}
