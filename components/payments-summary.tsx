import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type PaymentLine = {
  key: string
  date: string
  method: string
  amount: string
}

/**
 * A details dialog's payments: a table of what was paid, then a summary of
 * the total, what's already paid and what's still owed. Amounts arrive
 * pre-formatted.
 */
export function PaymentsSummary({
  payments,
  total,
  paid,
  owed,
  empty = "Nothing paid yet.",
}: {
  payments: PaymentLine[]
  total: string
  paid: string
  /** The amount still owed, or a word such as "Paid in full". */
  owed: string
  /** Shown instead of the table when there are no payments. */
  empty?: string
}) {
  return (
    <>
      <div className="grid gap-2">
        <h3 className="text-sm font-medium">Payments</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Date</TableHead>
                  <TableHead>Paid by</TableHead>
                  <TableHead className="pr-4 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.key}>
                    <TableCell className="pl-4">{payment.date}</TableCell>
                    <TableCell>{payment.method}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">
                      {payment.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <dl className="grid gap-2 rounded-lg border bg-muted/50 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="tabular-nums">{total}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Already paid</dt>
          <dd className="tabular-nums">{paid}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t pt-2 font-medium">
          <dt>Still owed</dt>
          <dd className="tabular-nums">{owed}</dd>
        </div>
      </dl>
    </>
  )
}
