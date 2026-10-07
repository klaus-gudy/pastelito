import {
  MobileCard,
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
import type { CapitalEntry } from "@/lib/generated/prisma/client"
import { formatMoney } from "@/lib/format"
import { capitalEntryLabels, paymentMethodLabels } from "@/lib/labels"

type Entry = CapitalEntry & { source: { name: string } }

export function HistoryTable({ entries }: { entries: Entry[] }) {
  return (
    <>
      <div className="hidden rounded-lg border @4xl/main:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Paid by</TableHead>
              <TableHead className="pr-4">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="pl-4">{formatDate(entry.date)}</TableCell>
                <TableCell className="font-medium">{entry.source.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={entry.type === "RECEIVED" ? "secondary" : "outline"}
                  >
                    {capitalEntryLabels[entry.type]}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(entry.amount)}
                </TableCell>
                <TableCell>{paymentMethodLabels[entry.method]}</TableCell>
                <TableCell className="max-w-64 truncate pr-4 text-muted-foreground">
                  {entry.note ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <MobileCards>
        {entries.map((entry) => (
          <MobileCard key={entry.id}>
            <MobileCardHeader
              title={entry.source.name}
              badge={
                <Badge
                  variant={entry.type === "RECEIVED" ? "secondary" : "outline"}
                >
                  {capitalEntryLabels[entry.type]}
                </Badge>
              }
              description={`${formatDate(entry.date)} · ${paymentMethodLabels[entry.method]}`}
              aside={
                <span className="font-medium tabular-nums">
                  {formatMoney(entry.amount)}
                </span>
              }
            />
            {entry.note && (
              <p className="truncate text-muted-foreground">{entry.note}</p>
            )}
          </MobileCard>
        ))}
      </MobileCards>
    </>
  )
}
