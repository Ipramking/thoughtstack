import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "crypto";

/**
 * ThoughtStack Auth — single-user credentials.
 *
 * Set these in Vercel → Settings → Environment Variables:
 *   ADMIN_EMAIL     = your email address
 *   ADMIN_PASSWORD  = your chosen password
 *   NEXTAUTH_SECRET = any long random string (openssl rand -base64 32)
 */
function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a.padEnd(64));
    const bb = Buffer.from(b.padEnd(64));
    return timingSafeEqual(ba.slice(0, 64), bb.slice(0, 64)) && a.length === b.length;
  } catch {
    return false;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email    = (credentials?.email    as string ?? "").toLowerCase().trim();
        const password = (credentials?.password as string ?? "");

        const adminEmail    = (process.env.ADMIN_EMAIL    ?? "").toLowerCase().trim();
        const adminPassword = (process.env.ADMIN_PASSWORD ?? "");

        if (!adminEmail || !adminPassword) {
          // No credentials configured — allow first-time access so user can set up
          if (email && password) {
            return { id: "admin", name: email.split("@")[0], email };
          }
          return null;
        }

        const emailOk    = safeEqual(email, adminEmail);
        const passwordOk = safeEqual(password, adminPassword);

        if (!emailOk || !passwordOk) return null;

        const name = process.env.ADMIN_NAME || adminEmail.split("@")[0];
        return { id: "admin", name, email };
      },
    }),
  ],

  pages: {
    signIn: "/auth",
    error:  "/auth",
  },

  session: {
    strategy: "jwt",
    maxAge:   30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.name = user.name;
      return token;
    },
    async session({ session, token }) {
      if (token?.name) session.user.name = token.name as string;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});
