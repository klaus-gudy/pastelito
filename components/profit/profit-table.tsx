import {
  MobileCard,
  MobileCardField,
  MobileCardFields,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards"
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
import { Prisma } from "@/lib/generated/prisma/client"
import { formatMoney } from "@/lib/format"

function saleProfit(sale: SaleRow) {
  const cost = sale.items.reduce(
    (sum, item) => sum.add(item.unitCost.mul(item.quantity)),
    new Prisma.Decimal(0)
  )
  const profit = sale.total.sub(cost)
  const margin = sale.total.gt(0)
    ? Math.round(profit.div(sale.total).mul(100).toNumber())
    : null
  return { cost, profit, margin, loss: profit.lt(0) }
}

/**
 * What each sale earned: its total (after any discount) minus what its stock
 * cost, at the average cost when the sale was made or the preorder delivered.
 */
export function ProfitTable({ sales }: { sales: SaleRow[] }) {
  return (
    <>
      <div className="hidden rounded-lg border @4xl/main:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Sale</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="pr-4 text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => {
              const { cost, profit, margin, loss } = saleProfit(sale)
              return (
                <TableRow key={sale.id}>
                  <TableCell className="pl-4">{formatDate(sale.date)}</TableCell>
                  <TableCell className="font-medium">
                    {sale.customer?.name ?? (
                      <span className="font-normal text-muted-foreground">
                        Walk-in
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {sale.orderedAt ? (
                      <Badge variant="secondary">Preorder</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-64 truncate">
                      {itemsSummary(sale)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(sale.total)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatMoney(cost)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {loss ? (
                      // A loss is marked in words too, not by colour alone.
                      <span className="text-destructive">
                        {formatMoney(profit)} loss
                      </span>
                    ) : (
                      formatMoney(profit)
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    {margin === null ? "—" : `${margin}%`}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <MobileCards>
        {sales.map((sale) => {
          const { cost, profit, margin, loss } = saleProfit(sale)
          return (
            <MobileCard key={sale.id}>
              <MobileCardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {sale.customer?.name ?? (
                      <span className="font-normal text-muted-foreground">
                        Walk-in
                      </span>
                    )}
                    {sale.orderedAt && <Badge variant="secondary">Preorder</Badge>}
                  </span>
                }
                description={formatDate(sale.date)}
                aside={
                  <>
                    <div className="text-xs text-muted-foreground">Profit</div>
                    <div className="font-medium tabular-nums">
                      {loss ? (
                        <span className="text-destructive">
                          {formatMoney(profit)} loss
                        </span>
                      ) : (
                        formatMoney(profit)
                      )}
                    </div>
                  </>
                }
              />
              <MobileCardFields className="grid-cols-3">
                <MobileCardField label="Items" className="col-span-3">
                  {itemsSummary(sale)}
                </MobileCardField>
                <MobileCardField label="Sale">
                  <span className="tabular-nums">{formatMoney(sale.total)}</span>
                </MobileCardField>
                <MobileCardField label="Cost">
                  <span className="tabular-nums text-muted-foreground">
                    {formatMoney(cost)}
                  </span>
                </MobileCardField>
                <MobileCardField label="Margin">
                  <span className="tabular-nums">
                    {margin === null ? "—" : `${margin}%`}
                  </span>
                </MobileCardField>
              </MobileCardFields>
            </MobileCard>
          )
        })}
      </MobileCards>
    </>
  )
}
