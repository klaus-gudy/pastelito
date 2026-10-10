import { connection } from "next/server"

import { prisma } from "@/lib/prisma"

// Liveness check for the host (Railway checks it before switching traffic to a
// new deployment). Public: it says only whether the app can reach its
// database, nothing about what is in it.
export async function GET() {
  await connection()
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ status: "ok" })
  } catch {
    return Response.json({ status: "database unavailable" }, { status: 503 })
  }
}
