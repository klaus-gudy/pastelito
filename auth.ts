import { randomBytes } from "node:crypto"

import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"

import { prisma } from "@/lib/prisma"
import { signInSchema } from "@/lib/validations/auth"

declare module "@auth/core/jwt" {
  interface JWT {
    /** Links the cookie session to its row in the Session table. */
    sessionToken?: string
  }
}

const DAY = 24 * 60 * 60
const SESSION_MAX_AGE = 30 * DAY

// Google sign-in is only offered once its OAuth credentials are configured.
export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
)

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // The Credentials provider only works with JWT sessions. Each one is also
  // recorded in the Session table and checked on every request, so deleting
  // the row (sign-out, password reset) ends the session right away.
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })
        if (!user?.passwordHash) return null

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        )
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }
      },
    }),
    ...(googleEnabled
      ? [
          // Google verifies email ownership, so a Google sign-in may attach
          // to an existing email + password account with the same address.
          Google({ allowDangerousEmailAccountLinking: true }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Sign-in: start a tracked session.
      if (user?.id) {
        const sessionToken = randomBytes(32).toString("base64url")
        await prisma.session.create({
          data: {
            sessionToken,
            userId: user.id,
            expires: new Date(Date.now() + SESSION_MAX_AGE * 1000),
          },
        })
        token.sessionToken = sessionToken
        return token
      }

      // Every other request: the session must still exist. Returning null
      // clears the cookie and signs the user out.
      if (!token.sessionToken) return null
      const session = await prisma.session.findUnique({
        where: { sessionToken: token.sessionToken },
      })
      if (!session || session.expires < new Date()) {
        if (session) {
          await prisma.session.delete({
            where: { sessionToken: session.sessionToken },
          })
        }
        return null
      }

      // Keep active sessions alive, updating the row at most once a day.
      const remaining = (session.expires.getTime() - Date.now()) / 1000
      if (remaining < SESSION_MAX_AGE - DAY) {
        await prisma.session.update({
          where: { sessionToken: session.sessionToken },
          data: { expires: new Date(Date.now() + SESSION_MAX_AGE * 1000) },
        })
      }
      return token
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
  events: {
    async signOut(message) {
      const sessionToken =
        "token" in message ? message.token?.sessionToken : undefined
      if (sessionToken) {
        await prisma.session.deleteMany({ where: { sessionToken } })
      }
    },
    async signIn({ user, account, profile }) {
      // Google has confirmed the email and has a profile photo; fill in
      // whatever the user doesn't have yet.
      if (account?.provider !== "google" || !user.id) return
      const existing = await prisma.user.findUnique({
        where: { id: user.id },
        select: { emailVerified: true, image: true },
      })
      if (!existing) return

      const verify =
        !existing.emailVerified && profile?.email_verified === true
      const picture =
        typeof profile?.picture === "string" ? profile.picture : null
      const setImage = !existing.image && picture
      if (verify || setImage) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(verify && { emailVerified: new Date() }),
            ...(setImage && { image: picture }),
          },
        })
      }
    },
  },
})
