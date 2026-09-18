import { describe, expect, it, vi, beforeEach } from "vitest";

// Obviously-fake fixture only.
const FAKE_SNIPPET = "const key = \"AKIA••••••••••••FAKE\";"; // already-redacted form, safe fixture

interface FakeFindingRow {
  id: string;
  repoFullName: string;
  filePath: string;
  commitSha: string;
  matchedRule: string;
  redactedSnippet: string;
  secretHash?: string;
  status: string;
  createdAt: Date;
}

let rows: FakeFindingRow[] = [];
let idCounter = 0;

function makeUniqueError() {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

let sharedPrisma: any;

function resetFakeDb() {
  rows = [];
  idCounter = 0;
  const client = {
    finding: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.Finding_dedup_key) {
          const { repoFullName, filePath, commitSha, matchedRule, secretHash } = where.Finding_dedup_key;
          const key = `${repoFullName}::${filePath}::${commitSha}::${matchedRule}::${secretHash ?? ""}`;
          const found = rows.find(
            (r: any) => `${r.repoFullName}::${r.filePath}::${r.commitSha}::${r.matchedRule}::${r.secretHash ?? ""}` === key
          );
          return found ? { id: found.id } : null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const key = `${data.repoFullName}::${data.filePath}::${data.commitSha}::${data.matchedRule}::${data.secretHash ?? ""}`;
        const exists = rows.find(
          (r: any) => `${r.repoFullName}::${r.filePath}::${r.commitSha}::${r.matchedRule}::${r.secretHash ?? ""}` === key
        );
        if (exists) {
          throw makeUniqueError();
        }
        idCounter++;
        const row: FakeFindingRow = {
          id: `finding_${idCounter}`,
          repoFullName: data.repoFullName,
          filePath: data.filePath,
          commitSha: data.commitSha,
          matchedRule: data.matchedRule,
          redactedSnippet: data.redactedSnippet,
          secretHash: data.secretHash,
          status: data.status ?? "PENDING",
          createdAt: new Date(),
        };
        rows.push(row);
        return row;
      }),
    },
  };
  sharedPrisma = client;
  return client;
}

vi.mock("../db", () => ({
  get prisma() {
    return sharedPrisma;
  },
}));

beforeEach(() => {
  resetFakeDb();
});

describe("upsertFinding idempotency", () => {
  it("creates a new Finding row on first scan of a commit/file/rule", async () => {
    const { upsertFinding } = await import("../scanner.worker");
    const result = await upsertFinding({
      repoFullName: "acme/widgets",
      filePath: "config/prod.env",
      commitSha: "abc1234",
      matchedRule: "AWS Access Key",
      redactedSnippet: FAKE_SNIPPET,
    });
    expect(result.wasCreated).toBe(true);
    expect(result.id).toBeDefined();
    expect(rows).toHaveLength(1);
  });

  it("does not create a duplicate row when the same commit/file/rule is scanned again", async () => {
    const { upsertFinding } = await import("../scanner.worker");
    const params = {
      repoFullName: "acme/widgets",
      filePath: "config/prod.env",
      commitSha: "abc1234",
      matchedRule: "AWS Access Key",
      redactedSnippet: FAKE_SNIPPET,
    };
    const first = await upsertFinding(params);
    const second = await upsertFinding(params);

    expect(first.wasCreated).toBe(true);
    expect(second.wasCreated).toBe(false); // skipped, not a duplicate row
    expect(rows).toHaveLength(1);
  });

  it("treats a different commitSha on the same file/rule as a distinct finding", async () => {
    const { upsertFinding } = await import("../scanner.worker");
    await upsertFinding({
      repoFullName: "acme/widgets",
      filePath: "config/prod.env",
      commitSha: "commit-1",
      matchedRule: "AWS Access Key",
      redactedSnippet: FAKE_SNIPPET,
    });
    await upsertFinding({
      repoFullName: "acme/widgets",
      filePath: "config/prod.env",
      commitSha: "commit-2",
      matchedRule: "AWS Access Key",
      redactedSnippet: FAKE_SNIPPET,
    });

    expect(rows).toHaveLength(2);
  });

  it("treats a different matchedRule on the same commit/file as a distinct finding", async () => {
    const { upsertFinding } = await import("../scanner.worker");
    await upsertFinding({
      repoFullName: "acme/widgets",
      filePath: "config/prod.env",
      commitSha: "abc1234",
      matchedRule: "AWS Access Key",
      redactedSnippet: FAKE_SNIPPET,
    });
    await upsertFinding({
      repoFullName: "acme/widgets",
      filePath: "config/prod.env",
      commitSha: "abc1234",
      matchedRule: "Generic High-Entropy String",
      redactedSnippet: FAKE_SNIPPET,
    });

    expect(rows).toHaveLength(2);
  });

  it("creates a finding with APPROVED status when status is specified", async () => {
    const { upsertFinding } = await import("../scanner.worker");
    const result = await upsertFinding({
      repoFullName: "acme/widgets",
      filePath: "config/prod.env",
      commitSha: "abc1234",
      matchedRule: "AWS Access Key",
      redactedSnippet: FAKE_SNIPPET,
      status: "APPROVED",
    });
    expect(result.wasCreated).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("APPROVED");
  });
});
