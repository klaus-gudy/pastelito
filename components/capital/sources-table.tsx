import { SourceActions } from "@/components/capital/source-actions"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { capitalSources } from "@/lib/capital"
import { Prisma } from "@/lib/generated/prisma/client"
import { formatMoney } from "@/lib/format"
import { capitalSourceTypes } from "@/lib/labels"

type Source = Awaited<ReturnType<typeof capitalSources>>[number]

const sum = (values: Prisma.Decimal[]) =>
  values.reduce((total, value) => total.add(value), new Prisma.Decimal(0))

export function SourcesTable({
  sources,
  verified,
  today,
}: {
  sources: Source[]
  verified: boolean
  today: string
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Source</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Repaid</TableHead>
            <TableHead>Outstanding</TableHead>
            <TableHead className="pr-4">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => (
            <TableRow key={source.id}>
              <TableCell className="pl-4">
                <span className="font-medium">{source.name}</span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {capitalSourceTypes[source.type].label}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums">
                {formatMoney(source.received)}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatMoney(source.repaid)}
              </TableCell>
              <TableCell className="font-medium tabular-nums">
                {formatMoney(source.outstanding)}
              </TableCell>
              <TableCell className="pr-4">
                <SourceActions
                  verified={verified}
                  today={today}
                  source={{
                    id: source.id,
                    name: source.name,
                    outstanding: formatMoney(source.outstanding),
                    hasOutstanding: source.outstanding.gt(0),
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="pl-4" colSpan={2}>
              Total
            </TableCell>
            <TableCell className="tabular-nums">
              {formatMoney(sum(sources.map((s) => s.received)))}
            </TableCell>
            <TableCell className="tabular-nums">
              {formatMoney(sum(sources.map((s) => s.repaid)))}
            </TableCell>
            <TableCell className="tabular-nums">
              {formatMoney(sum(sources.map((s) => s.outstanding)))}
            </TableCell>
            <TableCell className="pr-4" />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
