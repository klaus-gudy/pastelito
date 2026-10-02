import { NextResponse } from "next/server"

import { auth } from "@/auth"

const authPages = ["/sign-in", "/sign-up"]

// Optimistic redirects based on the session cookie. Pages and server actions
// still check the session themselves.
export default auth((req) => {
  const { pathname, search } = req.nextUrl
  const signedIn = Boolean(req.auth)

  if (!signedIn && pathname.startsWith("/dashboard")) {
    const url = new URL("/sign-in", req.nextUrl)
    url.searchParams.set("callbackUrl", pathname + search)
    return NextResponse.redirect(url)
  }

  if (signedIn && authPages.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
  }
})

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
}
