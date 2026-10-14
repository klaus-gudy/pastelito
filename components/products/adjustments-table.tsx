import { AdjustmentRowActions } from "@/components/products/adjustment-row-actions"
import {
  MobileCard,
  MobileCardActions,
  MobileCardField,
  MobileCardFields,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards"
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
import { stockAdjustmentReasonLabel } from "@/lib/labels"

export type AdjustmentRow = Prisma.StockMovementGetPayload<{
  include: { product: { select: { name: true; sizeMl: true } } }
}>

const productLabel = (row: AdjustmentRow) =>
  `${row.product.name} ${formatCount(row.product.sizeMl)} ml`

/** "+2" or "−3", with a true minus sign. */
const change = (quantity: number) =>
  quantity > 0 ? `+${formatCount(quantity)}` : `−${formatCount(-quantity)}`

/** The stock value the change moved, at the cost when it was made. */
const value = (row: AdjustmentRow) =>
  row.unitCost ? formatMoney(row.unitCost.mul(Math.abs(row.quantity))) : "—"

function describe(row: AdjustmentRow) {
  const count = Math.abs(row.quantity)
  const units = `${formatCount(count)} ${count === 1 ? "unit" : "units"}`
  return row.quantity < 0
    ? `${units} taken out of ${productLabel(row)}`
    : `${units} added to ${productLabel(row)}`
}

function ChangeBadge({ quantity }: { quantity: number }) {
  return (
    <Badge
      variant={quantity < 0 ? "outline" : "secondary"}
      className="tabular-nums"
    >
      {change(quantity)}
    </Badge>
  )
}

export function AdjustmentsTable({
  adjustments,
}: {
  adjustments: AdjustmentRow[]
}) {
  const actions = (row: AdjustmentRow) => (
    <AdjustmentRowActions id={row.id} what={describe(row)} />
  )

  return (
    <>
      <div className="hidden rounded-lg border @4xl/main:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Value at cost</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="pl-4">{formatDate(row.createdAt)}</TableCell>
                <TableCell className="font-medium">{productLabel(row)}</TableCell>
                <TableCell>
                  <ChangeBadge quantity={row.quantity} />
                </TableCell>
                <TableCell>{stockAdjustmentReasonLabel(row.reason)}</TableCell>
                <TableCell className="tabular-nums">{value(row)}</TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">
                  {row.note ?? "—"}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">{actions(row)}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <MobileCards>
        {adjustments.map((row) => (
          <MobileCard key={row.id}>
            <MobileCardHeader
              title={productLabel(row)}
              description={`${formatDate(row.createdAt)} · ${stockAdjustmentReasonLabel(row.reason)}`}
              aside={<ChangeBadge quantity={row.quantity} />}
            />
            <MobileCardFields>
              <MobileCardField label="Value at cost">
                <span className="tabular-nums">{value(row)}</span>
              </MobileCardField>
            </MobileCardFields>
            {row.note && (
              <p className="truncate text-muted-foreground">{row.note}</p>
            )}
            <MobileCardActions>{actions(row)}</MobileCardActions>
          </MobileCard>
        ))}
      </MobileCards>
    </>
  )
}
