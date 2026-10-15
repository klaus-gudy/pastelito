import { randomInt } from "node:crypto"

import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

// I and O are left out so they can't be mistaken for 1 and 0.
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const DIGITS = "0123456789"

/** A code that is easy to read out and type, e.g. "MKH975". */
export function generateOrderCode() {
  const pick = (chars: string) => chars[randomInt(chars.length)]
  return [LETTERS, LETTERS, LETTERS, DIGITS, DIGITS, DIGITS].map(pick).join("")
}

/** Codes are stored uppercase; a link typed in lowercase still works. */
export function normalizeOrderCode(code: string) {
  return code.trim().toUpperCase()
}

/**
 * The shop's order link code, made the first time it is needed. About
 * 12 million codes exist, so a clash is rare; it just draws another.
 */
export async function orderSlugFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { orderSlug: true },
  })
  if (user.orderSlug) return user.orderSlug

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateOrderCode()
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { orderSlug: code },
      })
      return code
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
  throw new Error("Couldn't pick an order link code.")
}
