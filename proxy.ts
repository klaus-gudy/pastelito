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

const isDev = process.env.NODE_ENV === "development"

// Only scripts carrying this request's nonce run; Next.js adds it to its own
// scripts, and 'strict-dynamic' lets those load the rest of the bundle.
// Styles stay 'unsafe-inline' because components set style attributes,
// which nonces can't cover. Google profile photos and the Google sign-in
// redirect are the only outside sources.
function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.googleusercontent.com",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")
}

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

  // A fresh nonce for every page. Next.js reads it from the request's CSP
  // header while rendering; the root layout reads x-nonce for next-themes.
  const nonce = btoa(crypto.randomUUID())
  const csp = contentSecurityPolicy(nonce)
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("Content-Security-Policy", csp)
  return response
})

export const config = {
  // Skip API routes, Next.js internals and files such as favicon.ico.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
}
