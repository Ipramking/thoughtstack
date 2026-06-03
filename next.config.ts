import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      // ── Service Worker ──────────────────────────────────────────────────────
      // Must always be revalidated so updates propagate immediately.
      // Service-Worker-Allowed: / gives it full-origin scope.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control",        value: "no-cache, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/"                       },
        ],
      },

      // ── App pages (HTML) ────────────────────────────────────────────────────
      // Vercel/Next.js default is "private, no-cache, no-store, max-age=0".
      // The "no-store" directive causes Chrome's Cache Storage API to REJECT
      // cache.put() calls, meaning the Service Worker can never cache pages for
      // offline use.  We override to remove "no-store" while keeping "private"
      // (no CDN caching) and "no-cache" (always revalidate in the HTTP cache).
      // The SW's cache is separate from the HTTP cache and is not affected by
      // "private" or "no-cache" — only "no-store" blocks it.
      {
        source: "/((?!_next/static|_next/image|api|.*\\.(?:ico|png|jpg|jpeg|svg|webp|json|txt|xml|woff2?)).*)",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
