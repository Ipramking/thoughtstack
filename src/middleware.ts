import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe NextAuth config — JWT verification only, no Node-only APIs.
const { auth } = NextAuth(authConfig);

// Routes that never require a session
const PUBLIC_PREFIXES = [
  "/auth",
  "/api/",     // ALL api routes are public at the middleware level.
                // Each route handler does its own auth check (e.g. CRON_SECRET,
                // NextAuth session, etc). Putting middleware in front of every
                // API call broke /sw.js, /manifest.json, AND /api/cron/* before.
  "/offline",
  "/reset",    // emergency rescue page — must be reachable even if app frozen
  "/_next",
  "/favicon",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Belt-and-braces: even if the matcher misses something, never redirect
  // public paths. The matcher regex has bitten us multiple times.
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return;
  }

  if (!req.auth) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth";
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }
});

// Matcher excludes static files (anything ending in a file extension) AND
// the api/_next/favicon prefixes. The in-function check above is the safety
// belt in case the regex misses something — we've been burned twice now.
export const config = {
  matcher: [
    "/((?!api|_next|favicon|.*\\.[\\w]+$).*)",
  ],
};
