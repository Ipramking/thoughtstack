import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config — no Node.js modules (no bcrypt, no Neon).
 * Used ONLY by the middleware so it runs in the Edge Runtime.
 * The full config with credentials lives in src/auth.ts.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/auth",
    error:  "/auth",
  },

  session: {
    strategy: "jwt",
    maxAge:   30 * 24 * 60 * 60,
  },

  callbacks: {
    // Called by middleware — just checks JWT presence
    authorized({ auth }) {
      return !!auth?.user;
    },

    async jwt({ token, user }) {
      if (user) {
        token.role   = (user as { role?: string }).role   ?? "user";
        token.status = (user as { status?: string }).status ?? "pending";
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.role   = token.role   as string;
        session.user.status = token.status as string;
      }
      return session;
    },
  },

  providers: [], // Credentials added in src/auth.ts (Node.js only)
};
