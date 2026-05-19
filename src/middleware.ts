import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME  = "ts-session";
const PUBLIC_PATHS = ["/auth", "/api/auth"];

/**
 * Real server-side auth guard.
 * Checks the ts-session cookie (set by /api/auth on login).
 * Any protected route without a valid cookie → redirect to /auth?from=<path>.
 * This eliminates the 404 bug — the user is always sent to the auth screen,
 * never to a broken page.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (isPublic) return NextResponse.next();

  const session = req.cookies.get(COOKIE_NAME);

  if (!session?.value) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth";
    loginUrl.search   = `?from=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
