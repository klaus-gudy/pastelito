import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"
import { setFlash } from "@/lib/set-flash"
import { consumeToken } from "@/lib/tokens"

// Target of the link in the verification email.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? ""
  const email = await consumeToken("verify-email", token)

  const { count } = email
    ? await prisma.user.updateMany({
        where: { email, emailVerified: null },
        data: { emailVerified: new Date() },
      })
    : { count: 0 }

  if (email) {
    await setFlash(
      count > 0
        ? { type: "success", message: "Email verified. Thanks!" }
        : { type: "info", message: "Your email is already verified." }
    )
  } else {
    await setFlash({
      type: "error",
      message: "This verification link is invalid or has expired.",
    })
  }

  // Signed-out visitors are sent on to sign-in, where the message shows.
  redirect("/")
}
