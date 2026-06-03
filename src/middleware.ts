import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Use the EDGE-SAFE config — no bcrypt, no Neon, no Node.js APIs.
// The middleware only needs to verify the JWT, not run the credentials check.
const { auth } = NextAuth(authConfig);

const PUBLIC = ["/auth", "/api/auth", "/offline"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (isPublic) return;

  if (!req.auth) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth";
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }
});

// ── Matcher ────────────────────────────────────────────────────────────────────
// CRITICAL: this MUST exclude ALL static files served from /public/, otherwise
// the browser tries to fetch /sw.js, gets redirected to /auth, receives HTML,
// and the service worker can never install. Same for /manifest.json and icons.
//
// The pattern below excludes:
//   - Next.js internals (_next/static, _next/image)
//   - All API routes (handled separately by NextAuth)
//   - Anything with a file extension (e.g. /sw.js, /manifest.json, /icon-192.png,
//     /favicon.ico, /robots.txt, etc.) — these are served from /public/.
//
// Without the trailing `\\.[\\w]+$` exclusion, the middleware was hijacking
// /sw.js requests and returning HTML, breaking the entire PWA install path.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.[\\w]+$).*)",
  ],
};
