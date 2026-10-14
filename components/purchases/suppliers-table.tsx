import {
  MobileCard,
  MobileCardActions,
  MobileCardField,
  MobileCardFields,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards"
import { SupplierRowActions } from "@/components/purchases/supplier-row-actions"
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

export type SupplierRow = {
  id: string
  name: string
  phone: string | null
  purchases: number
  spent: Prisma.Decimal
  lastPurchase: Date | null
}

export function SuppliersTable({
  suppliers,
  verified,
}: {
  suppliers: SupplierRow[]
  verified: boolean
}) {
  const actions = (supplier: SupplierRow) => (
    <SupplierRowActions
      verified={verified}
      supplier={{ id: supplier.id, name: supplier.name, phone: supplier.phone }}
    />
  )

  return (
    <>
      <div className="hidden rounded-lg border @4xl/main:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Supplier</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Purchases</TableHead>
              <TableHead>Total spent</TableHead>
              <TableHead>Last purchase</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="pl-4 font-medium">{supplier.name}</TableCell>
                <TableCell>{supplier.phone ?? "—"}</TableCell>
                <TableCell className="tabular-nums">
                  {formatCount(supplier.purchases)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(supplier.spent)}
                </TableCell>
                <TableCell>
                  {supplier.lastPurchase ? formatDate(supplier.lastPurchase) : "—"}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">{actions(supplier)}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <MobileCards>
        {suppliers.map((supplier) => (
          <MobileCard key={supplier.id}>
            <MobileCardHeader
              title={supplier.name}
              description={supplier.phone}
              aside={
                <span className="font-medium tabular-nums">
                  {formatMoney(supplier.spent)}
                </span>
              }
            />
            <MobileCardFields>
              <MobileCardField label="Purchases">
                <span className="tabular-nums">
                  {formatCount(supplier.purchases)}
                </span>
              </MobileCardField>
              <MobileCardField label="Last purchase">
                {supplier.lastPurchase ? formatDate(supplier.lastPurchase) : "—"}
              </MobileCardField>
            </MobileCardFields>
            <MobileCardActions>{actions(supplier)}</MobileCardActions>
          </MobileCard>
        ))}
      </MobileCards>
    </>
  )
}
