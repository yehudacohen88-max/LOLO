import type { NextConfig } from "next";

// HSTS is intentionally absent: a max-age on 127.0.0.1 would pin the browser
// for the local app. CSP is absent until a nonce pass exists; a strict policy
// breaks the Next.js runtime and the store camera scanner.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/", headers: securityHeaders },
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/legal",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/legal/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
