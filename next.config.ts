import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
