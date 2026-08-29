import { NextRequest } from "next/server";

/**
 * Validates that mutating requests (POST, PUT, PATCH, DELETE) originate from the same host
 * to protect against Cross-Site Request Forgery (CSRF).
 */
export function validateCsrfOrigin(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  // Safe HTTP methods do not change state and do not require origin verification
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return true;
  }

  const pathname = request.nextUrl.pathname;
  // Skip public submission endpoints, auth endpoints, or public webhooks
  if (
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/webhooks/")
  ) {
    return true;
  }

  const hostHeader = request.headers.get("host") || request.nextUrl.host;
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");

  let requestOriginHost: string | null = null;

  if (originHeader) {
    try {
      requestOriginHost = new URL(originHeader).host;
    } catch {
      return false;
    }
  } else if (refererHeader) {
    try {
      requestOriginHost = new URL(refererHeader).host;
    } catch {
      return false;
    }
  } else {
    // If neither Origin nor Referer header is present in browser requests during mutating calls, reject
    return false;
  }

  return requestOriginHost === hostHeader;
}
