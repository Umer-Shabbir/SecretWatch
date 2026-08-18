import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { verifyAdminCredentials } from "@/lib/admin-credentials";

/**
 * Admin-only auth configuration. SecretWatch has no end-user accounts as of
 * the scope correction (2026-08-17) — the only account type is ADMIN, signed
 * in via email+password Credentials provider. No PrismaAdapter is used: the
 * adapter exists to support OAuth account linking and database-backed
 * sessions, neither of which apply to a Credentials-only, JWT-session setup.
 * Auth.js v4 does not require an adapter when every provider is Credentials.
 */
export const authOptions: NextAuthOptions = {
  session: {
    // Credentials provider requires JWT sessions in Auth.js v4.
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/admin-sign-in",
    error: "/admin-sign-in",
  },
  providers: [
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin sign in",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        // Admin credential sign-in is only valid for ADMIN-role accounts that
        // have a password hash set. Never reveal which check failed.
        const valid = await verifyAdminCredentials(user, credentials.password);
        if (!valid || !user) {
          await recordAudit({
            userId: user?.id ?? null,
            action: "admin_signin_failed",
            detail: !user || user.role !== "ADMIN" ? "unknown_or_non_admin_account" : "bad_password",
          });
          return null;
        }

        await recordAudit({ userId: user.id, action: "admin_signin_success" });

        return {
          id: user.id,
          name: user.username ?? user.email,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: "USER" | "ADMIN" }).role ?? "USER";
        token.uid = user.id;
      } else if (token.uid && !token.role) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.uid as string } });
        token.role = dbUser?.role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as "USER" | "ADMIN") ?? "USER";
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await recordAudit({ userId: user.id, action: "signin" });
    },
    async signOut({ token }) {
      await recordAudit({ userId: (token?.uid as string) ?? null, action: "signout" });
    },
  },
};
