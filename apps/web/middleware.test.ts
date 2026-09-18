import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { getToken } from "next-auth/jwt";

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

describe("apps/web/middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  describe("API mutating routes CSRF protection", () => {
    it("allows safe GET requests without origin or referer", async () => {
      const req = new NextRequest("http://localhost:3000/api/findings", {
        method: "GET",
      });

      const res = await middleware(req);
      expect(res.status).toBe(200); // NextResponse.next()
    });

    it("blocks mutating POST requests without origin or referer", async () => {
      const req = new NextRequest("http://localhost:3000/api/findings/f1/approve", {
        method: "POST",
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("invalid_csrf_origin");
    });

    it("allows mutating POST requests with matching origin", async () => {
      const req = new NextRequest("http://localhost:3000/api/findings/f1/approve", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it("blocks mutating POST requests with cross-origin origin", async () => {
      const req = new NextRequest("http://localhost:3000/api/findings/f1/approve", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "https://evil.com",
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
    });

    it("allows public API endpoints without matching origin", async () => {
      const req = new NextRequest("http://localhost:3000/api/public/tokens", {
        method: "POST",
      });

      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe("Admin route protection (/admin)", () => {
    it("redirects unauthenticated users to /admin-sign-in with callbackUrl", async () => {
      vi.mocked(getToken).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/admin/review-queue");
      const res = await middleware(req);

      expect(res.status).toBe(307); // Next.js redirect
      const location = res.headers.get("location");
      expect(location).toContain("/admin-sign-in");
      expect(location).toContain("callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Fadmin%2Freview-queue");
    });

    it("redirects authenticated users with USER role to /unauthorized", async () => {
      vi.mocked(getToken).mockResolvedValue({
        sub: "user-1",
        email: "user@example.com",
        role: "USER",
      } as any);

      const req = new NextRequest("http://localhost:3000/admin/rules");
      const res = await middleware(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/unauthorized");
    });

    it("allows authenticated users with ADMIN role to access /admin", async () => {
      vi.mocked(getToken).mockResolvedValue({
        sub: "admin-1",
        email: "admin@example.com",
        role: "ADMIN",
      } as any);

      const req = new NextRequest("http://localhost:3000/admin/rules");
      const res = await middleware(req);

      expect(res.status).toBe(200);
    });
  });

  describe("Unprotected routes", () => {
    it("allows arbitrary public routes through without token verification", async () => {
      const req = new NextRequest("http://localhost:3000/features");
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(getToken).not.toHaveBeenCalled();
    });
  });
});
