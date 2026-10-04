import type { Metadata } from "next"
import { HandCoins, History } from "lucide-react"

import { AddEntryDialog } from "@/components/capital/add-entry-dialog"
import { AddSourceDialog } from "@/components/capital/add-source-dialog"
import { HistoryTable } from "@/components/capital/history-table"
import { SourcesTable } from "@/components/capital/sources-table"
import { TablePagination } from "@/components/table-pagination"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { TabsContent } from "@/components/ui/tabs"
import { UrlTabs } from "@/components/url-tabs"
import { capitalSources } from "@/lib/capital"
import { requireUser } from "@/lib/current-user"
import { todayIso } from "@/lib/dates"
import { formatMoney } from "@/lib/format"
import { capitalSourceTypes } from "@/lib/labels"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Capital · Pastelito" }

const PAGE_SIZE = 10

export default async function CapitalPage({
  searchParams,
}: PageProps<"/capital">) {
  const user = await requireUser()
  const verified = Boolean(user.emailVerified)
  const today = todayIso()

  const [sources, entryCount] = await Promise.all([
    capitalSources(user.id),
    prisma.capitalEntry.count({ where: { userId: user.id } }),
  ])

  if (sources.length === 0) {
    return (
      <Empty className="flex-1 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HandCoins />
          </EmptyMedia>
          <EmptyTitle>No capital yet</EmptyTitle>
          <EmptyDescription>
            Record the money that funds your stock: your own savings, an
            investor, or a loan.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <AddSourceDialog verified={verified} today={today} />
        </EmptyContent>
      </Empty>
    )
  }

  const params = await searchParams
  const tab = params.tab === "history" ? "history" : "sources"
  const requestedPage = Number(params.page)
  const pageCount = Math.max(1, Math.ceil(entryCount / PAGE_SIZE))
  const page = Number.isInteger(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), pageCount)
    : 1
  const entries = await prisma.capitalEntry.findMany({
    where: { userId: user.id },
    include: { source: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  return (
    <UrlTabs
      defaultValue={tab}
      className="flex-1 gap-4"
      tabs={[
        { value: "sources", label: "Sources", count: sources.length },
        { value: "history", label: "History", count: entryCount },
      ]}
      actions={{
        sources: <AddSourceDialog verified={verified} today={today} />,
        history: (
          <AddEntryDialog
            verified={verified}
            today={today}
            sources={sources.map((source) => ({
              id: source.id,
              name: source.name,
              typeLabel: capitalSourceTypes[source.type].label,
              outstanding: formatMoney(source.outstanding),
              hasOutstanding: source.outstanding.gt(0),
            }))}
          />
        ),
      }}
    >
      <TabsContent value="sources">
        <SourcesTable sources={sources} verified={verified} today={today} />
      </TabsContent>

      <TabsContent value="history" className="flex flex-col gap-4">
        {entryCount === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyTitle>No money recorded yet</EmptyTitle>
              <EmptyDescription>
                Use Add entry, or Receive on a source, to record money.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <HistoryTable entries={entries} />
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={entryCount}
              params={{ tab: "history" }}
            />
          </>
        )}
      </TabsContent>
    </UrlTabs>
  )
}
