import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
