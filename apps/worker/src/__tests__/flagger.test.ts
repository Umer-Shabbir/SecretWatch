import { describe, expect, it, vi, beforeEach } from "vitest";

const mockTemplates: any[] = [];
const mockFindings: any[] = [];
let flagRateLimitThreshold = 5;

vi.mock("@/lib/system-settings", () => ({
  getSystemSettings: vi.fn(async () => ({
    flaggerEnabled: true,
    flagRateLimitThreshold,
    scannerEnabled: true,
    autoApproveEnabled: false,
    autoFlagEnabled: false,
    scanResultsPerRule: 10,
    updatedAt: new Date().toISOString()
  })),
}));

vi.mock("../db", () => ({
  prisma: {
    messageTemplate: {
      findFirst: vi.fn(async (args: any) => {
        const { where } = args;
        
        if (where.isDefault) {
          return mockTemplates.find(t => t.isDefault);
        }
        
        // Simulating the actual DB queries
        if (where.severity && where.secretType === null) {
          return mockTemplates.find(t => t.severity === where.severity && !t.secretType);
        }
        
        if (where.secretType && where.severity === null) {
          return mockTemplates.find(t => t.secretType === where.secretType && !t.severity);
        }

        if (where.severity && where.secretType) {
          return mockTemplates.find(t => t.severity === where.severity && t.secretType === where.secretType);
        }
        
        if (where.severity) {
           return mockTemplates.find(t => t.severity === where.severity);
        }

        if (where.secretType) {
           return mockTemplates.find(t => t.secretType === where.secretType);
        }
        return null;
      }),
      create: vi.fn(async (args: any) => {
        const t = { id: "new-default", ...args.data };
        mockTemplates.push(t);
        return t;
      })
    }
  }
}));

import { inferSecretTypeFromRule, resolveTemplateForFinding } from "../flagger.worker";

describe("inferSecretTypeFromRule", () => {
  it("maps rule names to correct secret types", () => {
    expect(inferSecretTypeFromRule("AWS Access Key")).toBe("AWS_KEY");
    expect(inferSecretTypeFromRule("GitHub Token")).toBe("GITHUB_TOKEN");
    expect(inferSecretTypeFromRule("Postgres DB Connection String")).toBe("DB_CONNECTION_STRING");
    expect(inferSecretTypeFromRule("Stripe Secret Key")).toBe("GENERIC_API_KEY");
  });
});

describe("resolveTemplateForFinding", () => {
  beforeEach(() => {
    mockTemplates.length = 0;
  });

  it("returns default template directly", async () => {
    mockTemplates.push({ id: "default", isDefault: true });

    const tmpl = await resolveTemplateForFinding({ severity: "CRITICAL", matchedRule: "AWS Access Key" });
    expect(tmpl.id).toBe("default");
  });

  it("creates and falls back to default if no matches found", async () => {
    const tmpl = await resolveTemplateForFinding({ severity: "LOW", matchedRule: "Generic API Key" });
    expect(tmpl.id).toBe("new-default");
    expect(tmpl.isDefault).toBe(true);
  });
});
