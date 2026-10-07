import {
  MobileCard,
  MobileCardActions,
  MobileCardField,
  MobileCardFields,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards"
import { PreorderActions } from "@/components/preorders/preorder-actions"
import {
  itemsSummary,
  saleBalance,
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
import { formatMoney } from "@/lib/format"

function StockBadge({ ready }: { ready: boolean }) {
  return ready ? (
    <Badge>Ready</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Waiting
    </Badge>
  )
}

export function PreordersTable({
  preorders,
  readyIds,
  verified,
  today,
}: {
  preorders: SaleRow[]
  /** Preorders that stock on hand can fill. */
  readyIds: Set<string>
  verified: boolean
  today: string
}) {
  const rows = preorders.map((preorder) => {
    const { paid, balance, owed } = saleBalance(preorder)
    // A preorder always has a customer.
    const customer = preorder.customer?.name ?? "Unknown customer"
    const ready = readyIds.has(preorder.id)
    const actions = (
      <PreorderActions
        ready={ready}
        verified={verified}
        today={today}
        details={toSaleDetails(preorder)}
        preorder={{
          id: preorder.id,
          customer,
          balance: owed ? formatMoney(balance) : null,
          balanceAmount: balance.toNumber(),
        }}
      />
    )
    return { preorder, paid, balance, owed, customer, ready, actions }
  })

  return (
    <>
      <div className="hidden rounded-lg border @4xl/main:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Ordered</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(
              ({ preorder, paid, balance, owed, customer, ready, actions }) => (
                <TableRow key={preorder.id}>
                  <TableCell className="pl-4">
                    {formatDate(preorder.date)}
                  </TableCell>
                  {/* max-w-0 lets these two columns share what's left of the
                      row and cut long text off with an ellipsis. */}
                  <TableCell className="w-1/4 max-w-0 font-medium">
                    <span className="block truncate" title={customer}>
                      {customer}
                    </span>
                  </TableCell>
                  <TableCell className="w-1/3 max-w-0">
                    <span
                      className="block truncate"
                      title={itemsSummary(preorder)}
                    >
                      {itemsSummary(preorder)}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatMoney(preorder.total)}
                    <span className="block text-xs text-muted-foreground">
                      {paid.gt(0)
                        ? `Deposit ${formatMoney(paid)}`
                        : "No deposit"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {owed ? (
                      <span className="tabular-nums">{formatMoney(balance)}</span>
                    ) : (
                      <Badge variant="outline">Paid</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StockBadge ready={ready} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex items-center justify-end gap-1">
                      {actions}
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>
      <MobileCards>
        {rows.map(
          ({ preorder, paid, balance, owed, customer, ready, actions }) => (
            <MobileCard key={preorder.id}>
              <MobileCardHeader
                title={customer}
                description={`Ordered ${formatDate(preorder.date)}`}
                aside={<StockBadge ready={ready} />}
              />
              <MobileCardFields>
                <MobileCardField label="Items" className="col-span-2">
                  <span className="line-clamp-2">{itemsSummary(preorder)}</span>
                </MobileCardField>
                <MobileCardField label="Total">
                  <span className="tabular-nums">
                    {formatMoney(preorder.total)}
                  </span>
                </MobileCardField>
                <MobileCardField label="Deposit">
                  {paid.gt(0) ? (
                    <span className="tabular-nums">{formatMoney(paid)}</span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </MobileCardField>
                <MobileCardField label="Balance">
                  {owed ? (
                    <span className="font-medium tabular-nums">
                      {formatMoney(balance)}
                    </span>
                  ) : (
                    <Badge variant="outline">Paid</Badge>
                  )}
                </MobileCardField>
              </MobileCardFields>
              <MobileCardActions className="gap-1">{actions}</MobileCardActions>
            </MobileCard>
          )
        )}
      </MobileCards>
    </>
  )
}
