import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { PUT, DELETE } from "./[id]/route";
import { RepositoryFilterType } from "@prisma/client";

interface FakeFilterRow {
  id: string;
  type: RepositoryFilterType;
  pattern: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

let rows: FakeFilterRow[] = [];
let currentSessionUserId: string | null = "admin-1";
let currentSessionRole: "USER" | "ADMIN" = "ADMIN";
const auditCalls: Array<{ userId: string; action: string; detail?: string }> = [];

let sharedPrisma: any;

function resetFakeDb(seed: FakeFilterRow[]) {
  rows = [...seed];
  const client = {
    repositoryFilter: {
      findMany: vi.fn(async () => [...rows]),
      findUnique: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const row: FakeFilterRow = {
          id: `rf_${Math.random().toString(36).slice(2)}`,
          type: data.type,
          pattern: data.pattern,
          enabled: data.enabled ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error("Not found");
        rows[idx] = {
          ...rows[idx],
          ...data,
          updatedAt: new Date(),
        };
        return rows[idx];
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error("Not found");
        const [removed] = rows.splice(idx, 1);
        return removed;
      }),
    },
  };
  sharedPrisma = client;
  return client;
}

vi.mock("@/lib/db", () => ({
  get prisma() {
    return sharedPrisma;
  },
}));

vi.mock("@/lib/authorize", () => ({
  requireAdmin: vi.fn(async () => {
    if (!currentSessionUserId) {
      return { session: null, error: "unauthenticated" };
    }
    if (currentSessionRole !== "ADMIN") {
      return {
        session: { user: { id: currentSessionUserId, role: currentSessionRole } },
        error: "forbidden",
      };
    }
    return {
      session: { user: { id: currentSessionUserId, role: "ADMIN" } },
      error: null,
    };
  }),
}));

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn(async (entry: { userId: string; action: string; detail?: string }) => {
    auditCalls.push(entry);
  }),
}));

describe("Repository Filter API Routes", () => {
  beforeEach(() => {
    currentSessionUserId = "admin-1";
    currentSessionRole = "ADMIN";
    auditCalls.length = 0;
    resetFakeDb([
      {
        id: "rf_1",
        type: "ALLOW",
        pattern: "my-org/*",
        enabled: true,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
      {
        id: "rf_2",
        type: "BLOCK",
        pattern: "*/test-*",
        enabled: true,
        createdAt: new Date("2026-01-02"),
        updatedAt: new Date("2026-01-02"),
      },
    ]);
  });

  describe("GET /api/repository-filters", () => {
    it("returns 401 when unauthenticated", async () => {
      currentSessionUserId = null;
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns 403 when user is not admin", async () => {
      currentSessionRole = "USER";
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("returns all repository filters for admin", async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.filters).toHaveLength(2);
      expect(data.filters[0].pattern).toBe("my-org/*");
    });
  });

  describe("POST /api/repository-filters", () => {
    it("returns 400 when pattern is missing", async () => {
      const req = new NextRequest("http://localhost/api/repository-filters", {
        method: "POST",
        body: JSON.stringify({ type: "ALLOW" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain("pattern is required");
    });

    it("returns 400 when type is invalid", async () => {
      const req = new NextRequest("http://localhost/api/repository-filters", {
        method: "POST",
        body: JSON.stringify({ type: "INVALID", pattern: "foo/bar" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("creates filter and records audit event", async () => {
      const req = new NextRequest("http://localhost/api/repository-filters", {
        method: "POST",
        body: JSON.stringify({ type: "BLOCK", pattern: "malicious-org/*", enabled: true }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.filter.pattern).toBe("malicious-org/*");
      expect(data.filter.type).toBe("BLOCK");

      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0].action).toBe("repository_filter_created");
      expect(auditCalls[0].userId).toBe("admin-1");
    });
  });

  describe("PUT /api/repository-filters/[id]", () => {
    it("returns 404 for unknown filter ID", async () => {
      const req = new NextRequest("http://localhost/api/repository-filters/nonexistent", {
        method: "PUT",
        body: JSON.stringify({ pattern: "new-pattern" }),
      });
      const res = await PUT(req, { params: { id: "nonexistent" } });
      expect(res.status).toBe(404);
    });

    it("updates filter properties and records audit event", async () => {
      const req = new NextRequest("http://localhost/api/repository-filters/rf_1", {
        method: "PUT",
        body: JSON.stringify({ pattern: "my-org/production-*", enabled: false }),
      });
      const res = await PUT(req, { params: { id: "rf_1" } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.filter.pattern).toBe("my-org/production-*");
      expect(data.filter.enabled).toBe(false);

      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0].action).toBe("repository_filter_updated");
    });
  });

  describe("DELETE /api/repository-filters/[id]", () => {
    it("returns 404 for unknown filter ID", async () => {
      const req = new NextRequest("http://localhost/api/repository-filters/nonexistent", {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: { id: "nonexistent" } });
      expect(res.status).toBe(404);
    });

    it("deletes filter and returns 204", async () => {
      const req = new NextRequest("http://localhost/api/repository-filters/rf_2", {
        method: "DELETE",
      });
      const res = await DELETE(req, { params: { id: "rf_2" } });
      expect(res.status).toBe(204);
      expect(rows.find((r) => r.id === "rf_2")).toBeUndefined();

      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0].action).toBe("repository_filter_deleted");
    });
  });
});
