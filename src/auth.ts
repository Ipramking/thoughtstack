import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { findUserByEmail, initDb } from "@/lib/db";

let dbReady = false;

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

        // Ensure DB + admin seed on first call
        if (!dbReady) { await initDb(); dbReady = true; }

        const user = await findUserByEmail(email);
        if (!user) return null;

        const passwordOk = await bcrypt.compare(password, user.password_hash as string);
        if (!passwordOk) return null;

        // Return status so the client can show a helpful error
        return {
          id:     user.id as string,
          name:   user.name as string,
          email:  user.email as string,
          role:   user.role as string,
          status: user.status as string,
        };
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
      if (user) {
        token.role   = (user as { role?: string }).role ?? "user";
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

    async signIn({ user }) {
      const u = user as { status?: string };
      // Block sign-in for non-approved accounts
      if (u.status && u.status !== "approved") {
        throw new Error(`status:${u.status}`);
      }
      return true;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});
