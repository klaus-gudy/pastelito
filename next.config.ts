import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  // The Content-Security-Policy is set per request in proxy.ts, with a nonce.
  // Older browsers that ignore its frame-ancestors: no clickjacking via iframes.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Password reset and verification links carry their token in the URL;
  // never pass full URLs on to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Lets the dev server be opened at 127.0.0.1 as well as localhost, e.g. to
  // test signed-out while staying signed in on localhost (cookies are
  // per-hostname).
  allowedDevOrigins: ["127.0.0.1"],
  // App pages used to live under /dashboard; keep old links working.
  async redirects() {
    return [
      { source: "/dashboard", destination: "/", permanent: true },
      { source: "/dashboard/:path*", destination: "/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
