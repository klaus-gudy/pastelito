import { NextResponse } from "next/server"

import { auth } from "@/auth"

// Pages anyone can open. Everything else needs a signed-in user.
const publicPaths = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]
// Signed-in users have no reason to see these.
const signedOutOnly = ["/sign-in", "/sign-up"]

// Optimistic redirects based on the session cookie. Pages and server actions
// still check the session themselves.
export default auth((req) => {
  const { pathname, search } = req.nextUrl
  const signedIn = Boolean(req.auth)

  if (!signedIn && !publicPaths.includes(pathname)) {
    const url = new URL("/sign-in", req.nextUrl)
    if (pathname !== "/") {
      url.searchParams.set("callbackUrl", pathname + search)
    }
    return NextResponse.redirect(url)
  }

  if (signedIn && signedOutOnly.includes(pathname)) {
    return NextResponse.redirect(new URL("/", req.nextUrl))
  }
})

export const config = {
  // Skip API routes, Next.js internals and files such as favicon.ico.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
}
