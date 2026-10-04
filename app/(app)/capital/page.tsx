import type { Metadata } from "next"
import { HandCoins, History } from "lucide-react"

import { AddSourceDialog } from "@/components/capital/add-source-dialog"
import { HistoryTable } from "@/components/capital/history-table"
import { SourcesTable } from "@/components/capital/sources-table"
import { TablePagination } from "@/components/table-pagination"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UrlTabs } from "@/components/url-tabs"
import { capitalSources } from "@/lib/capital"
import { requireUser } from "@/lib/current-user"
import { todayIso } from "@/lib/dates"
import { formatCount } from "@/lib/format"
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
    <UrlTabs defaultValue={tab} firstTab="sources" className="flex-1 gap-4">
      <div className="flex items-center justify-between gap-4">
        <TabsList>
          <TabsTrigger value="sources">
            Sources
            <Badge variant="secondary">{formatCount(sources.length)}</Badge>
          </TabsTrigger>
          <TabsTrigger value="history">
            History
            <Badge variant="secondary">{formatCount(entryCount)}</Badge>
          </TabsTrigger>
        </TabsList>
        <AddSourceDialog verified={verified} today={today} />
      </div>

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
                Use the menu on a source to record money received.
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
