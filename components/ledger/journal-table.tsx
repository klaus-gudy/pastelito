import {
  MobileCard,
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
import { formatDate, TIME_ZONE } from "@/lib/dates"
import { formatMoney } from "@/lib/format"
import type { CashJournalEntry } from "@/lib/generated/prisma/client"
import { cashJournalKindLabels, paymentMethodLabels } from "@/lib/labels"

type Row = CashJournalEntry & {
  reverses: { seq: number } | null
  reversedBy: { seq: number } | null
}

const recordedAt = new Intl.DateTimeFormat("en-TZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
})

/** What happened, with a note on how it ties to a reversal. */
function Status({ row }: { row: Row }) {
  if (row.reverses) {
    return <Badge variant="outline">Reverses #{row.reverses.seq}</Badge>
  }
  if (row.reversedBy) {
    return <Badge variant="secondary">Reversed by #{row.reversedBy.seq}</Badge>
  }
  return null
}

function Amount({ row }: { row: Row }) {
  const debit = row.direction === "DEBIT"
  return (
    <span
      className={
        debit
          ? "text-emerald-700 tabular-nums dark:text-emerald-400"
          : "tabular-nums"
      }
    >
      {debit ? "+" : "−"}
      {formatMoney(row.amount)}
    </span>
  )
}

export function JournalTable({ rows }: { rows: Row[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border @4xl/main:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>What happened</TableHead>
              <TableHead>Paid by</TableHead>
              <TableHead className="text-right">In (debit)</TableHead>
              <TableHead className="text-right">Out (credit)</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="pr-4">Recorded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className={row.reversedBy ? "text-muted-foreground" : undefined}
              >
                <TableCell className="pl-4 tabular-nums">{row.seq}</TableCell>
                <TableCell>{formatDate(row.occurredAt)}</TableCell>
                <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                <TableCell className="max-w-80">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate" title={row.description}>
                      {row.description}
                    </span>
                    <Status row={row} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {cashJournalKindLabels[row.kind]}
                  </div>
                </TableCell>
                <TableCell>
                  {row.method ? paymentMethodLabels[row.method] : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {row.direction === "DEBIT" && <Amount row={row} />}
                </TableCell>
                <TableCell className="text-right">
                  {row.direction === "CREDIT" && <Amount row={row} />}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(row.balanceAfter)}
                </TableCell>
                <TableCell className="pr-4 whitespace-nowrap text-muted-foreground">
                  {recordedAt.format(row.recordedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <MobileCards>
        {rows.map((row) => (
          <MobileCard key={row.id}>
            <MobileCardHeader
              title={row.description}
              badge={<Status row={row} />}
              description={`#${row.seq} · ${formatDate(row.occurredAt)} · ${row.reference}`}
              aside={<Amount row={row} />}
            />
            <MobileCardFields>
              <MobileCardField label="Type">
                {cashJournalKindLabels[row.kind]}
                {row.method && ` · ${paymentMethodLabels[row.method]}`}
              </MobileCardField>
              <MobileCardField label="Balance after">
                <span className="font-medium tabular-nums">
                  {formatMoney(row.balanceAfter)}
                </span>
              </MobileCardField>
              <MobileCardField label="Recorded">
                {recordedAt.format(row.recordedAt)}
              </MobileCardField>
            </MobileCardFields>
          </MobileCard>
        ))}
      </MobileCards>
    </>
  )
}
