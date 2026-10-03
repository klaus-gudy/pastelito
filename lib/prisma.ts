import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/lib/generated/prisma/client"

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

// Reuse one client across hot reloads in development so we don't exhaust
// database connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>
  prismaClientClass?: typeof PrismaClient
}

// `prisma generate` reloads the client class. A client built from the old
// class still expects the old schema (e.g. dropped columns), so replace it.
if (globalForPrisma.prismaClientClass !== PrismaClient) {
  void globalForPrisma.prisma?.$disconnect()
  globalForPrisma.prisma = undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaClientClass = PrismaClient
}
