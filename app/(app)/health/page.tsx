import type { Metadata } from "next"

import { EditTargetsDialog } from "@/components/health/edit-targets-dialog"
import { HealthTile } from "@/components/health/health-tile"
import { HealthVerdict } from "@/components/health/health-verdict"
import { PeriodFilter } from "@/components/overview/period-filter"
import { requireUser } from "@/lib/current-user"
import { periodRanges, periods } from "@/lib/dates"
import { businessHealth, resolveTargets } from "@/lib/health"
import { prisma } from "@/lib/prisma"
import { healthInputs } from "@/lib/reports"

export const metadata: Metadata = { title: "Business health · Pastelito" }

export default async function HealthPage({
  searchParams,
}: PageProps<"/health">) {
  const user = await requireUser()
  const { period: requested } = await searchParams
  const period = periods.find((value) => value === requested) ?? "month"

  const saved = await prisma.healthTargets.findUnique({
    where: { userId: user.id },
  })
  const targets = resolveTargets(saved)
  const inputs = await healthInputs(
    user.id,
    periodRanges(period),
    targets.overdueDays
  )
  const { indicators, verdict } = businessHealth(inputs, targets)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter value={period} />
        <EditTargetsDialog
          verified={Boolean(user.emailVerified)}
          saved={{
            marginPct: saved?.marginPct,
            collectionPct: saved?.collectionPct,
            salesTrendPct: saved?.salesTrendPct,
            stockMaxDays: saved?.stockMaxDays,
            paybackPct: saved?.paybackPct,
            overdueDays: saved?.overdueDays,
            repeatPct: saved?.repeatPct,
            preorderMaxDays: saved?.preorderMaxDays,
          }}
        />
      </div>

      <HealthVerdict verdict={verdict} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {indicators.map((indicator) => (
          <HealthTile key={indicator.key} indicator={indicator} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Margin, collection, sales trend, stock cover and repeat customers follow
        the period above. Capital earned back, overdue debts and preorder wait
        are measured as things stand today.
      </p>
    </div>
  )
}
