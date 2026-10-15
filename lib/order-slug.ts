import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

const MAX_LENGTH = 24

/**
 * The shop name as a link-friendly word: "Graça's Perfumes" ->
 * "gracas-perfumes". Empty when nothing usable is left.
 */
export function slugify(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_LENGTH)
    .replace(/^-+|-+$/g, "")
}

/** "graca", then "graca-2", "graca-3", … for shops with the same name. */
export function slugCandidates(name: string | null, count = 20) {
  const base = slugify(name ?? "") || "shop"
  return [base, ...Array.from({ length: count - 1 }, (_, i) => `${base}-${i + 2}`)]
}

/**
 * The shop's order link name, picking one from its name the first time.
 * Another shop may claim the same name at the same moment, so a clash
 * moves on to the next candidate.
 */
export async function orderSlugFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, orderSlug: true },
  })
  if (user.orderSlug) return user.orderSlug

  const candidates = slugCandidates(user.name)
  const taken = new Set(
    (
      await prisma.user.findMany({
        where: { orderSlug: { in: candidates } },
        select: { orderSlug: true },
      })
    ).map((other) => other.orderSlug)
  )
  // Past the numbered names, a random suffix is all but certain to be free.
  const random = `${candidates[0]}-${Math.random().toString(36).slice(2, 6)}`
  for (const slug of [...candidates.filter((c) => !taken.has(c)), random]) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { orderSlug: slug },
      })
      return slug
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue
      }
      throw error
    }
  }
  throw new Error("Couldn't pick an order link name.")
}
