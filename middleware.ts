import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that never require a session
const PUBLIC_PATHS = ["/auth"];
const PUBLIC_PREFIXES = ["/api/auth", "/_next", "/favicon"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("ts-session");

  // Always pass through public paths and Next.js internals
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) {
    // If user is already logged in and hits /auth → send them home
    if (pathname === "/auth" && session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // All other routes: require session cookie
  if (!session) {
    const loginUrl = new URL("/auth", request.url);
    // Preserve where they were trying to go so we can redirect back after login
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except static files and API routes handled above
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/thoughts).*)"],
};
