// Turns "the database can't be reached" into a message a form can show,
// instead of a crash. Any other error is rethrown untouched.

export const DB_UNAVAILABLE =
  "Can't reach the database right now. Try again in a moment."

// Prisma codes for unreachable, timed-out or closed connections, plus the
// Node network codes the pg driver adapter passes through.
const UNAVAILABLE_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "57P01", // Postgres shutting down
])

/** True when the error, or anything it wraps, means the database is down. */
export function isDbUnavailable(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 5) return false
  const { code, name, cause } = error as {
    code?: unknown
    name?: unknown
    cause?: unknown
  }
  if (typeof code === "string" && UNAVAILABLE_CODES.has(code)) return true
  if (name === "PrismaClientInitializationError") return true
  // Auth.js wraps errors from authorize() as `cause.err`.
  const wrapped = (cause as { err?: unknown } | undefined)?.err
  return (
    isDbUnavailable(cause, depth + 1) || isDbUnavailable(wrapped, depth + 1)
  )
}

/**
 * Runs a server action's body so an unreachable database comes back as
 * `{ message }`, which every form already shows, rather than an error page.
 * Call it inside the exported function: "use server" files can only export
 * plain async functions.
 */
export async function withDbErrors<
  State extends { message?: string } | undefined,
>(run: () => Promise<State>): Promise<State> {
  try {
    return await run()
  } catch (error) {
    if (!isDbUnavailable(error)) throw error
    console.error(error)
    return { message: DB_UNAVAILABLE } as State
  }
}
