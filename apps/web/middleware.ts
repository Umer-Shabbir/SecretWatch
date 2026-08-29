import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { validateCsrfOrigin } from "@/lib/csrf";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. CSRF validation for mutating API routes
  if (pathname.startsWith("/api/")) {
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json(
        { error: "invalid_csrf_origin", message: "Cross-site request forgery protection blocked this request" },
        { status: 403 }
      );
    }
  }

  // 2. Auth guard for admin UI routes
  if (pathname.startsWith("/admin")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const signInUrl = new URL("/admin-sign-in", req.url);
      signInUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(signInUrl);
    }

    if (token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
