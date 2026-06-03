import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't fail production builds on ESLint warnings.
  // We've had three deploys blocked by phantom eslint-disable pragmas
  // referencing rules the project doesn't have configured. ESLint still
  // runs in `npm run lint` locally — it just no longer blocks `next build`.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // TypeScript errors still block the build — type safety is non-negotiable.
  // (typescript.ignoreBuildErrors is INTENTIONALLY left as default false.)

  async headers() {
    return [
      // Service worker — never cached so updates propagate on every visit.
      // Service-Worker-Allowed: / grants full-origin scope.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control",          value: "no-cache, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/"                         },
        ],
      },
    ];
  },
};

export default nextConfig;
