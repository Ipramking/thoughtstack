import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { findUserByEmail, initDb } from "@/lib/db";
import { authConfig } from "@/auth.config";

let dbReady = false;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        const email    = (credentials?.email    as string ?? "").toLowerCase().trim();
        const password = (credentials?.password as string ?? "");

        if (!dbReady) { await initDb(); dbReady = true; }

        const user = await findUserByEmail(email);
        if (!user) return null;

        const passwordOk = await bcrypt.compare(password, user.password_hash as string);
        if (!passwordOk) return null;

        return {
          id:     user.id     as string,
          name:   user.name   as string,
          email:  user.email  as string,
          role:   user.role   as string,
          status: user.status as string,
        };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user }) {
      const u = user as { status?: string };
      if (u.status && u.status !== "approved") {
        throw new Error(`status:${u.status}`);
      }
      return true;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});
