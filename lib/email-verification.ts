// Email verification can be switched off with EMAIL_VERIFICATION=off, e.g.
// while there is no way to deliver emails yet. Users then count as verified
// without the flag being stored, so switching it back on asks them again.

type Env = Record<string, string | undefined>

export function emailVerificationRequired(env: Env = process.env) {
  return env.EMAIL_VERIFICATION?.trim().toLowerCase() !== "off"
}

/** Whether the user may do things that need a verified email. */
export function isVerified(
  user: { emailVerified: Date | null },
  env: Env = process.env
) {
  return !emailVerificationRequired(env) || user.emailVerified !== null
}
