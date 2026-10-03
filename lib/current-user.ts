import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/** The signed-in user, or a redirect to sign-in. For pages and server actions. */
export async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, emailVerified: true },
  })
  if (!user) redirect("/sign-in")
  return user
}

/** Saving new records needs a verified email. */
export const VERIFY_TO_SAVE = "Verify your email before adding records."
