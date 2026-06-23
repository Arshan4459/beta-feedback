import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Allow the browser to PUT clips directly to your object storage (presigned URLs).
const s3PublicOrigin = process.env.NEXT_PUBLIC_S3_PUBLIC_ENDPOINT ?? "";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "img-src 'self' data:",
  "media-src 'self' blob: data:", // recorded clips play from blob: URLs
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self' ${s3PublicOrigin}`.trim(),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
]
  .join("; ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
