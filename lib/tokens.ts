import { createHash, randomBytes } from "node:crypto"

import { prisma } from "@/lib/prisma"

// One-time tokens for emailed links, stored in Auth.js's VerificationToken
// table. Only a SHA-256 hash is stored, so a leaked row can't be used as a link.

export type TokenPurpose = "verify-email" | "reset-password"

const HOUR = 60 * 60 * 1000

const lifetimes: Record<TokenPurpose, number> = {
  "verify-email": 24 * HOUR,
  "reset-password": 1 * HOUR,
}

// Minimum time between two emails for the same purpose and address.
const RESEND_COOLDOWN = 60 * 1000

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex")

const identifierFor = (purpose: TokenPurpose, email: string) =>
  `${purpose}:${email}`

/**
 * Replaces any earlier token for this purpose and email with a new one.
 * Returns the raw token for the link, or null if one was issued too recently.
 */
export async function issueToken(purpose: TokenPurpose, email: string) {
  const identifier = identifierFor(purpose, email)
  const lifetime = lifetimes[purpose]

  const latest = await prisma.verificationToken.findFirst({
    where: { identifier },
    orderBy: { expires: "desc" },
  })
  const issuedAt = latest ? latest.expires.getTime() - lifetime : 0
  if (Date.now() - issuedAt < RESEND_COOLDOWN) return null

  const token = randomBytes(32).toString("base64url")
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token: hash(token),
        expires: new Date(Date.now() + lifetime),
      },
    }),
  ])
  return token
}

/** Returns the email a valid, unexpired token was issued for, without using it up. */
export async function peekToken(purpose: TokenPurpose, token: string) {
  if (!token || token.length > 200) return null

  const record = await prisma.verificationToken.findFirst({
    where: { token: hash(token), identifier: { startsWith: `${purpose}:` } },
  })
  if (!record || record.expires < new Date()) return null

  return {
    email: record.identifier.slice(purpose.length + 1),
    identifier: record.identifier,
    hashedToken: record.token,
  }
}

/** Uses up a token. Returns its email, or null if it was invalid, expired or already used. */
export async function consumeToken(purpose: TokenPurpose, token: string) {
  const record = await peekToken(purpose, token)
  if (!record) return null

  // Deleting is the "use"; a count of 0 means another request got there first.
  const { count } = await prisma.verificationToken.deleteMany({
    where: { identifier: record.identifier, token: record.hashedToken },
  })
  return count === 1 ? record.email : null
}
