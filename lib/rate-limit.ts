// Fixed-window rate limits for sign-in, sign-up and password reset requests.
// Counts live in this server process: enough for a single instance. Running
// several instances needs a shared store (e.g. Redis) behind the same API.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Drop expired buckets once the map grows, so it can't grow without bound.
const SWEEP_AT = 10_000

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimit = { limit: number; windowMs: number }

/**
 * Counts one attempt against `key`. Returns false once more than `limit`
 * attempts were made in the current window.
 */
export function hit(key: string, { limit, windowMs }: RateLimit) {
  const now = Date.now()
  if (buckets.size >= SWEEP_AT) sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  bucket.count += 1
  return bucket.count <= limit
}

/** Forgets the attempts against `key`, e.g. after a successful sign-in. */
export function reset(key: string) {
  buckets.delete(key)
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
