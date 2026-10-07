import {
  MobileCard,
  MobileCardActions,
  MobileCardField,
  MobileCardFields,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards"
import { PreorderActions } from "@/components/preorders/preorder-actions"
import { RecordPaymentDialog } from "@/components/sales/record-payment-dialog"
import { SaleDetailsDialog } from "@/components/sales/sale-details-dialog"
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
              <TableHead className="pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preorders.map((preorder) => {
              const { paid, balance, owed } = saleBalance(preorder)
              const ready = readyIds.has(preorder.id)
              // A preorder always has a customer.
              const customer = preorder.customer?.name ?? "Unknown customer"
              return (
                <TableRow key={preorder.id}>
                  <TableCell className="pl-4">
                    {formatDate(preorder.date)}
                  </TableCell>
                  {/* Name and items wrap so the table fits a laptop screen
                      next to the sidebar. */}
                  <TableCell className="min-w-32 font-medium whitespace-normal">
                    {customer}
                  </TableCell>
                  <TableCell className="min-w-36 whitespace-normal">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="line-clamp-2">
                        {itemsSummary(preorder)}
                      </span>
                      {ready ? (
                        <Badge>Ready</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          Waiting
                        </Badge>
                      )}
                    </div>
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
                  <TableCell className="pr-4">
                    <div className="flex items-center justify-end gap-2">
                      {owed && (
                        <RecordPaymentDialog
                          verified={verified}
                          today={today}
                          customer={customer}
                          sale={{
                            id: preorder.id,
                            balance: formatMoney(balance),
                            balanceAmount: balance.toNumber(),
                          }}
                        />
                      )}
                      <SaleDetailsDialog
                        preorder
                        verified={verified}
                        today={today}
                        sale={toSaleDetails(preorder)}
                      />
                      <PreorderActions
                        ready={ready}
                        verified={verified}
                        today={today}
                        preorder={{
                          id: preorder.id,
                          customer,
                          balance: owed ? formatMoney(balance) : null,
                          balanceAmount: balance.toNumber(),
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <MobileCards>
        {preorders.map((preorder) => {
          const { paid, balance, owed } = saleBalance(preorder)
          const ready = readyIds.has(preorder.id)
          // A preorder always has a customer.
          const customer = preorder.customer?.name ?? "Unknown customer"
          return (
            <MobileCard key={preorder.id}>
              <MobileCardHeader
                title={customer}
                description={`Ordered ${formatDate(preorder.date)}`}
                aside={
                  ready ? (
                    <Badge>Ready</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Waiting
                    </Badge>
                  )
                }
              />
              <MobileCardFields>
                <MobileCardField label="Items" className="col-span-2">
                  {itemsSummary(preorder)}
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
              <MobileCardActions>
                {owed && (
                  <RecordPaymentDialog
                    verified={verified}
                    today={today}
                    customer={customer}
                    sale={{
                      id: preorder.id,
                      balance: formatMoney(balance),
                      balanceAmount: balance.toNumber(),
                    }}
                  />
                )}
                <SaleDetailsDialog
                  preorder
                  verified={verified}
                  today={today}
                  sale={toSaleDetails(preorder)}
                />
                <PreorderActions
                  ready={ready}
                  verified={verified}
                  today={today}
                  preorder={{
                    id: preorder.id,
                    customer,
                    balance: owed ? formatMoney(balance) : null,
                    balanceAmount: balance.toNumber(),
                  }}
                />
              </MobileCardActions>
            </MobileCard>
          )
        })}
      </MobileCards>
    </>
  )
}
