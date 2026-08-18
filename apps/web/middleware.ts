import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Returning false here routes the request to `pages.signIn` in
      // lib/auth.ts rather than a raw 401 — combined with the session-expired
      // screen below for previously-authenticated users.
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/admin-sign-in",
    },
  }
);

export const config = {
  // Only /admin/* remains protected after the 2026-08-17 scope correction —
  // there are no end-user accounts, so /dashboard and /tokens are gone.
  matcher: ["/admin/:path*"],
};
