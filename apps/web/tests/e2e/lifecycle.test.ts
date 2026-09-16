import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as SubmitTokenPost } from "@/app/api/public/tokens/route";
import { GET as FindingsGet } from "@/app/api/findings/route";
import { POST as ApproveFindingPost } from "@/app/api/findings/[id]/approve/route";
import { POST as RunScannerPost } from "@/app/api/admin/scan/run/route";
// Mocks
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

vi.mock("@/lib/github-validate", () => ({
  validateGitHubToken: vi.fn(async () => ({ valid: true, scopes: ["repo"] })),
}));

vi.mock("@/lib/github-validate", () => ({
  validateGitHubToken: vi.fn(async () => ({ valid: true, scopes: [] })),
}));

process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");

vi.mock("@/lib/queue", () => ({
  enqueueScanJobs: vi.fn(async (rules) => rules.length),
  enqueueFlagJob: vi.fn(),
  enqueueFlagJobs: vi.fn(async (findings) => findings.length),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    githubToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    systemSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    messageTemplate: {
      findMany: vi.fn(),
    },
    workerJob: {
      create: vi.fn(),
    },
    scanRule: {
      findMany: vi.fn(),
    },
    finding: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    }
  }
}));

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(() => Promise.resolve({
    user: { id: "admin-123", email: "admin@example.com", role: "ADMIN" }
  }))
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

// Mock rate limit
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => Promise.resolve({ allowed: true, retryAfterMs: 0 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

// Helper to create a NextRequest
function createRequest(url: string, method: string, body?: any, host?: string) {
  const req = new NextRequest(`https://secretwatch.app${url}`, {
    method,
    headers: {
      host: host || "secretwatch.app",
      "content-type": "application/json",
      ...(host ? { origin: `https://${host}` } : { origin: "https://secretwatch.app" })
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return req;
}

describe("E2E API Lifecycle Test", () => {
  let dbState: any = {
    tokens: [],
    findings: [],
    jobs: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dbState = {
      tokens: [],
      findings: [],
      jobs: []
    };

    // Advanced Prisma Mocking for state across calls
    vi.mocked(prisma.githubToken.create as any).mockImplementation(async ({ data }: any) => {
      const token = { id: `token-${Date.now()}`, ...data };
      dbState.tokens.push(token);
      return token;
    });

    vi.mocked(prisma.systemSetting.upsert as any).mockResolvedValue({
      id: "singleton",
      scannerEnabled: true,
      flaggerEnabled: true,
      autoFlagEnabled: false,
      autoApproveEnabled: false,
      scanResultsPerRule: 30,
      flagRateLimitThreshold: 10,
      scanIntervalMinutes: 60,
      updatedAt: new Date(),
    });

    vi.mocked(prisma.scanRule.findMany as any).mockResolvedValue([
      { id: "rule-github-pat" } as any,
    ]);

    vi.mocked((prisma as any).workerJob.create as any).mockImplementation(async ({ data }: any) => {
      const job = { id: `job-${Date.now()}`, ...data };
      dbState.jobs.push(job);
      return job;
    });

    vi.mocked(prisma.finding.findMany as any).mockImplementation(async () => {
      return dbState.findings;
    });

    vi.mocked(prisma.finding.count as any).mockImplementation(async () => dbState.findings.length);

    vi.mocked(prisma.finding.findUnique as any).mockImplementation(async ({ where }: any) => {
      return dbState.findings.find((f: any) => f.id === where.id);
    });

    vi.mocked(prisma.finding.updateMany as any).mockImplementation(async ({ where, data }: any) => {
      let count = 0;
      for (const idx in dbState.findings) {
        if (dbState.findings[idx].id === where.id) {
          dbState.findings[idx] = { ...dbState.findings[idx], ...data };
          count++;
        }
      }
      return { count };
    });
  });

  it("Executes the complete lifecycle from submission to scanning to approval", async () => {
    // 1. Submit a token publically
    const submitReq = createRequest("/api/public/tokens", "POST", {
      token: "ghp_1234567890abcdefghijklmnopqrstuvwxyzabcd"
    });
    const submitRes = await SubmitTokenPost(submitReq);
    expect(submitRes.status).toBe(201);
    const submitData = await submitRes.json();
    expect(submitData.maskedIdentifier).toBeDefined();

    expect(dbState.tokens.length).toBe(1);
    const tokenId = dbState.tokens[0].id;

    // 2. Trigger a manual scan (as admin)
    const scanRes = await RunScannerPost();
    expect(scanRes.status).toBe(200);
    const scanData = await scanRes.json();
    expect(scanData.enqueued).toBe(1);
    expect(scanData.scannerEnabled).toBe(true);

    // 3. Simulate Worker inserting a finding (bypass API, insert directly into dbState)
    const findingId = `finding-${Date.now()}`;
    dbState.findings.push({
      id: findingId,
      status: "PENDING",
      repository: "test/repo",
      redactedSnippet: "ghp_1234***abcd",
      type: "GITHUB_PAT",
      severity: "CRITICAL",
      commitSha: "abc1234def5678",
      repoFullName: "test/repo",
      filePath: "config/secrets.env",
      matchedRule: "GitHub Personal Access Token",
      createdAt: new Date()
    });

    // 4. Read the finding queue
    const getFindingReq = createRequest("/api/findings", "GET");
    const getFindingRes = await FindingsGet(getFindingReq);
    expect(getFindingRes.status).toBe(200);
    const getFindingData = await getFindingRes.json();
    expect(getFindingData.findings).toHaveLength(1);
    expect(getFindingData.findings[0].id).toBe(findingId);

    // 5. Admin Approves the finding
    const approveReq = createRequest(`/api/findings/${findingId}/approve`, "POST", {}, "secretwatch.app");
    const approveRes = await ApproveFindingPost(approveReq, { params: { id: findingId }});
    expect(approveRes.status).toBe(200);
    
    // Verify finding state is now FLAGGED
    expect(dbState.findings[0].status).toBe("APPROVED");

    // Verify audit log was recorded
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "finding_approved"
    }));
  });
});
