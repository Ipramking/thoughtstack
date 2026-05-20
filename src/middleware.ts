import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Use the EDGE-SAFE config — no bcrypt, no Neon, no Node.js APIs.
// The middleware only needs to verify the JWT, not run the credentials check.
const { auth } = NextAuth(authConfig);

const PUBLIC = ["/auth", "/api/auth"];

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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
