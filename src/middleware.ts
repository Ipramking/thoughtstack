import { NextRequest, NextResponse } from "next/server";

/**
 * ThoughtStack middleware — client-side auth guard.
 *
 * Since all user data lives in localStorage (not cookies/JWTs), we can't
 * read auth state on the server.  Instead we let every route through and
 * delegate the redirect to the AppShell component — EXCEPT for routes
 * that must always be public (/auth, /api/*, static assets).
 *
 * The AppShell checks localStorage for a valid profile on every mount and
 * pushes to /auth?from=<currentPath> when none is found.  This means:
 *  - First visit          → /auth  (clean onboarding)
 *  - Session "timeout"    → /auth  (AppShell picks it up immediately)
 *  - Direct deep-link     → /auth  (not a 404)
 *  - Returning user       → page   (profile already in localStorage)
 */
export function middleware(_req: NextRequest) {
  // Allow everything through — auth is enforced client-side in AppShell.
  return NextResponse.next();
}

export const config = {
  /*
   * Match all routes except Next.js internals and static files so the
   * middleware runs on every navigation but doesn't interfere with assets.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
