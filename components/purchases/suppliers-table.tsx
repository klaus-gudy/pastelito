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

export function SuppliersTable({ suppliers }: { suppliers: SupplierRow[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Supplier</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Purchases</TableHead>
            <TableHead>Total spent</TableHead>
            <TableHead className="pr-4">Last purchase</TableHead>
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
              <TableCell className="pr-4">
                {supplier.lastPurchase ? formatDate(supplier.lastPurchase) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
