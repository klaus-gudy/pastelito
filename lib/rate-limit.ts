import { prisma } from "@/lib/prisma"

// Fixed-window rate limits for sign-in, sign-up and password reset requests.
// Counts live in the RateLimit table, so every server instance shares them
// and they survive restarts.

export type RateLimit = { limit: number; windowMs: number }

// Roughly one call in this many also deletes expired rows.
const PRUNE_EVERY = 100

/**
 * Counts one attempt against `key`. Returns false once more than `limit`
 * attempts were made in the current window.
 */
export async function hit(key: string, { limit, windowMs }: RateLimit) {
  const now = new Date()
  const resetAt = new Date(now.getTime() + windowMs)
  // One statement, so concurrent attempts can't both read the old count:
  // a new key starts at 1, an expired window restarts at 1, otherwise +1.
  // Tagged-template values are sent as query parameters.
  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= ${now}
        THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now}
        THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count"`

  if (Math.random() * PRUNE_EVERY < 1) {
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lte: now } } })
  }
  return row.count <= limit
}

/** Forgets the attempts against `key`, e.g. after a successful sign-in. */
export async function reset(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key } })
}

/**
 * The client's IP address for rate limiting. Takes the last X-Forwarded-For
 * entry, the one added by the proxy in front of the app; earlier entries are
 * whatever the client sent and can't be trusted.
 */
export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")
  const last = forwarded?.split(",").at(-1)?.trim()
  return last || headers.get("x-real-ip")?.trim() || "unknown"
}

const MINUTE = 60 * 1000

export const limits = {
  // Per account: stops password guessing against one user.
  signInPerEmail: { limit: 10, windowMs: 15 * MINUTE },
  // Per address: stops spraying common passwords across many accounts.
  signInPerIp: { limit: 50, windowMs: 15 * MINUTE },
  signUpPerIp: { limit: 10, windowMs: 60 * MINUTE },
  // Each address already waits a minute between emails; this caps how many
  // different inboxes one client can send reset emails to.
  passwordResetPerIp: { limit: 10, windowMs: 60 * MINUTE },
} satisfies Record<string, RateLimit>
