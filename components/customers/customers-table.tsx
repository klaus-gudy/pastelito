import { CustomerRowActions } from "@/components/customers/customer-row-actions"
import {
  MobileCard,
  MobileCardActions,
  MobileCardField,
  MobileCardFields,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards"
import type { SaleProductOption } from "@/components/sales/new-sale-dialog"
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

export function CustomersTable({
  customers,
  products,
  verified,
  today,
}: {
  customers: CustomerRow[]
  /** For the sale and preorder dialogs in each row's menu. */
  products: SaleProductOption[]
  verified: boolean
  today: string
}) {
  const actions = (customer: CustomerRow) => (
    <CustomerRowActions
      verified={verified}
      today={today}
      products={products}
      customer={{
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      }}
    />
  )

  return (
    <>
      <div className="hidden rounded-lg border @4xl/main:block">
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
                {/* max-w-0 lets name and email share what's left of the row
                    and cut long text off with an ellipsis. */}
                <TableCell className="w-1/3 max-w-0 pl-4 font-medium">
                  <span className="block truncate" title={customer.name}>
                    {customer.name}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">
                  {customer.phone ? formatPhone(customer.phone) : "—"}
                </TableCell>
                <TableCell className="w-1/3 max-w-0">
                  {customer.email ? (
                    <span className="block truncate" title={customer.email}>
                      {customer.email}
                    </span>
                  ) : (
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
                  <div className="flex items-center justify-end gap-1">
                    {actions(customer)}
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
              <MobileCardField label="Email" className="col-span-2">
                {customer.email ?? "—"}
              </MobileCardField>
            </MobileCardFields>
            <MobileCardActions className="gap-1">
              {actions(customer)}
            </MobileCardActions>
          </MobileCard>
        ))}
      </MobileCards>
    </>
  )
}
