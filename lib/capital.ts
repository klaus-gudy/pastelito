import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

const ZERO = new Prisma.Decimal(0)

type Db = Prisma.TransactionClient | typeof prisma

/** Total received and repaid for each of the user's capital sources. */
export async function capitalTotals(userId: string, db: Db = prisma) {
  const rows = await db.capitalEntry.groupBy({
    by: ["sourceId", "type"],
    where: { userId },
    _sum: { amount: true },
  })
  const totals = new Map<
    string,
    { received: Prisma.Decimal; repaid: Prisma.Decimal }
  >()
  for (const row of rows) {
    const entry = totals.get(row.sourceId) ?? { received: ZERO, repaid: ZERO }
    const amount = row._sum.amount ?? ZERO
    if (row.type === "RECEIVED") entry.received = entry.received.add(amount)
    else entry.repaid = entry.repaid.add(amount)
    totals.set(row.sourceId, entry)
  }
  return totals
}

/** Sources with received, repaid and outstanding (received minus repaid). */
export async function capitalSources(userId: string) {
  const [sources, totals] = await Promise.all([
    prisma.capitalSource.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    capitalTotals(userId),
  ])
  return sources.map((source) => {
    const { received, repaid } = totals.get(source.id) ?? {
      received: ZERO,
      repaid: ZERO,
    }
    return { ...source, received, repaid, outstanding: received.sub(repaid) }
  })
}
