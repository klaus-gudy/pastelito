import type { Metadata } from "next"
import { BookText, CircleAlert, ListOrdered, Wallet } from "lucide-react"

import { JournalTable } from "@/components/ledger/journal-table"
import { LoadMore } from "@/components/load-more"
import { StatTile } from "@/components/overview/stat-tile"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { requireUser } from "@/lib/current-user"
import { formatCount, formatMoney } from "@/lib/format"
import { shownCount } from "@/lib/list-size"
import { prisma } from "@/lib/prisma"
import { businessSummary } from "@/lib/reports"

export const metadata: Metadata = { title: "Cash ledger · Pastelito" }

const PAGE_SIZE = 25

export default async function LedgerPage({
  searchParams,
}: PageProps<"/ledger">) {
  const user = await requireUser()
  const params = await searchParams
  const shown = shownCount(params.show, PAGE_SIZE)

  const [rows, count, { cash }] = await Promise.all([
    prisma.cashJournalEntry.findMany({
      where: { userId: user.id },
      include: {
        reverses: { select: { seq: true } },
        reversedBy: { select: { seq: true } },
      },
      orderBy: { seq: "desc" },
      take: shown,
    }),
    prisma.cashJournalEntry.count({ where: { userId: user.id } }),
    businessSummary(user.id),
  ])

  if (count === 0) {
    return (
      <Empty className="flex-1 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookText />
          </EmptyMedia>
          <EmptyTitle>No cash movements yet</EmptyTitle>
          <EmptyDescription>
            Every time cash comes in or goes out, from capital, sales,
            purchases, expenses or refunds, it is written here with the
            balance after it.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  // The newest row is first; its balance is where the journal stands.
  const balance = rows[0].balanceAfter
  // The journal is written with every change to cash, so it must agree with
  // cash worked out from the records. If not, a change wasn't journaled.
  const reconciled = balance.eq(cash) && rows[0].seq === count

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Balance"
          icon={Wallet}
          value={formatMoney(balance)}
          caption={reconciled ? "Matches cash on hand" : "Doesn't match cash"}
          note="Cash after the latest entry. It is checked against the cash worked out from your capital, sales, purchases and expenses."
        />
        <StatTile
          label="Entries"
          icon={ListOrdered}
          value={formatCount(count)}
          caption="Never changed or deleted"
          note="Entries can't be edited. A correction or deletion adds a reversal of the old entry, then a new one, so the full history stays."
        />
      </div>

      {!reconciled && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>The ledger doesn&apos;t match your cash</AlertTitle>
          <AlertDescription>
            The ledger says {formatMoney(balance)} but your records add up to{" "}
            {formatMoney(cash)}. Some change to cash wasn&apos;t written to the
            ledger.
          </AlertDescription>
        </Alert>
      )}

      <section className="flex min-w-0 flex-col gap-4">
        <JournalTable rows={rows} />
        <LoadMore shown={shown} pageSize={PAGE_SIZE} total={count} />
      </section>
    </div>
  )
}
