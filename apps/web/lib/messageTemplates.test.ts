import { describe, expect, it, vi, beforeEach } from "vitest";

interface FakeMessageTemplateRow {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
  severity: string | null;
  secretType: string | null;
  includeAttributionLine: boolean;
  createdAt: Date;
  updatedAt: Date;
}

let rows: FakeMessageTemplateRow[] = [];

function makeRow(overrides: Partial<FakeMessageTemplateRow>): FakeMessageTemplateRow {
  return {
    id: overrides.id ?? `tmpl_${Math.random()}`,
    name: overrides.name ?? "Default Secret Finding",
    body: overrides.body ?? "Found {{rule}} in {{file}} ({{repo}}).",
    isDefault: overrides.isDefault ?? false,
    severity: overrides.severity ?? null,
    secretType: overrides.secretType ?? null,
    includeAttributionLine: overrides.includeAttributionLine ?? false,
    createdAt: overrides.createdAt ?? new Date("2026-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01"),
  };
}

let sharedPrisma: any;

function resetFakeDb(seed: FakeMessageTemplateRow[]) {
  rows = seed;
  const client = {
    messageTemplate: {
      findMany: vi.fn(async () => [...rows]),
      findUnique: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      count: vi.fn(async () => rows.length),
      create: vi.fn(async ({ data }: any) => {
        const row: FakeMessageTemplateRow = {
          id: `tmpl_${Math.random()}`,
          name: data.name,
          body: data.body,
          isDefault: data.isDefault ?? false,
          severity: data.severity ?? null,
          secretType: data.secretType ?? null,
          includeAttributionLine: data.includeAttributionLine ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error("not found");
        rows[idx] = { ...rows[idx], ...data, updatedAt: new Date() };
        return rows[idx];
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error("not found");
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

beforeEach(() => {
  resetFakeDb([
    makeRow({ id: "default1", name: "Default Secret Finding", isDefault: true, createdAt: new Date("2026-01-01") }),
    makeRow({ id: "custom1", name: "Custom Template", isDefault: false, createdAt: new Date("2026-01-02") }),
  ]);
});

describe("listMessageTemplates", () => {
  it("orders isDefault first, then createdAt ascending", async () => {
    const { listMessageTemplates } = await import("./messageTemplates");
    const templates = await listMessageTemplates();
    expect(templates.map((t) => t.id)).toEqual(["default1", "custom1"]);
  });
});

describe("createMessageTemplate — validation", () => {
  it("throws on empty name", async () => {
    const { createMessageTemplate } = await import("./messageTemplates");
    await expect(createMessageTemplate({ name: "  ", body: "hello {{repo}}" })).rejects.toThrow(
      "Name must not be empty"
    );
  });

  it("throws on empty body", async () => {
    const { createMessageTemplate } = await import("./messageTemplates");
    await expect(createMessageTemplate({ name: "New Template", body: "" })).rejects.toThrow(
      "Body must not be empty"
    );
  });

  it("throws InvalidVariableError naming the exact unsupported token", async () => {
    const { createMessageTemplate, InvalidVariableError } = await import("./messageTemplates");
    await expect(createMessageTemplate({ name: "Bad Template", body: "Leaked: {{secret}}" })).rejects.toThrow(
      InvalidVariableError
    );
    try {
      await createMessageTemplate({ name: "Bad Template", body: "Leaked: {{secret}}" });
      throw new Error("expected rejection");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidVariableError);
      expect((err as InstanceType<typeof InvalidVariableError>).variable).toBe("secret");
    }
  });

  it("accepts all supported variables together", async () => {
    const { createMessageTemplate } = await import("./messageTemplates");
    const template = await createMessageTemplate({
      name: "All Vars",
      body: "{{repo}} {{file}} {{rule}}",
    });
    expect(template.name).toBe("All Vars");
    expect(template.isDefault).toBe(false);
  });

  it("enforces the max body length guard", async () => {
    const { createMessageTemplate } = await import("./messageTemplates");
    const longBody = "a".repeat(5001);
    await expect(createMessageTemplate({ name: "Too Long", body: longBody })).rejects.toThrow(
      "must not exceed 5000 characters"
    );
  });

  it("never sets isDefault: true from caller input", async () => {
    const { createMessageTemplate } = await import("./messageTemplates");
    const template = await createMessageTemplate({ name: "Sneaky", body: "{{repo}}" });
    expect(template.isDefault).toBe(false);
  });
});

describe("updateMessageTemplate — validation", () => {
  it("throws MessageTemplateNotFoundError for a missing id", async () => {
    const { updateMessageTemplate, MessageTemplateNotFoundError } = await import("./messageTemplates");
    await expect(updateMessageTemplate("nope", { name: "X" })).rejects.toThrow(MessageTemplateNotFoundError);
  });

  it("throws InvalidVariableError on an unsupported variable in body update", async () => {
    const { updateMessageTemplate, InvalidVariableError } = await import("./messageTemplates");
    await expect(updateMessageTemplate("custom1", { body: "{{token}}" })).rejects.toThrow(InvalidVariableError);
  });

  it("updates only the provided field", async () => {
    const { updateMessageTemplate } = await import("./messageTemplates");
    const updated = await updateMessageTemplate("custom1", { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
  });
});

describe("deleteMessageTemplate — guards", () => {
  it("throws MessageTemplateNotFoundError for a missing id", async () => {
    const { deleteMessageTemplate, MessageTemplateNotFoundError } = await import("./messageTemplates");
    await expect(deleteMessageTemplate("nope")).rejects.toThrow(MessageTemplateNotFoundError);
  });

  it("throws CannotDeleteDefaultError when targeting the default template", async () => {
    const { deleteMessageTemplate, CannotDeleteDefaultError } = await import("./messageTemplates");
    await expect(deleteMessageTemplate("default1")).rejects.toThrow(CannotDeleteDefaultError);
  });

  it("throws CannotDeleteLastTemplateError when only one non-default row remains", async () => {
    resetFakeDb([makeRow({ id: "only1", isDefault: false })]);
    const { deleteMessageTemplate, CannotDeleteLastTemplateError } = await import("./messageTemplates");
    await expect(deleteMessageTemplate("only1")).rejects.toThrow(CannotDeleteLastTemplateError);
  });

  it("throws CannotDeleteDefaultError (not CannotDeleteLastTemplateError) when the last remaining row is also default", async () => {
    resetFakeDb([makeRow({ id: "solo-default", isDefault: true })]);
    const { deleteMessageTemplate, CannotDeleteDefaultError } = await import("./messageTemplates");
    await expect(deleteMessageTemplate("solo-default")).rejects.toThrow(CannotDeleteDefaultError);
  });

  it("succeeds deleting a non-default template when more than one row exists", async () => {
    const { deleteMessageTemplate } = await import("./messageTemplates");
    await expect(deleteMessageTemplate("custom1")).resolves.toBeUndefined();
    expect(rows.some((r) => r.id === "custom1")).toBe(false);
  });
});

describe("renderMessageTemplatePreview", () => {
  it("renders against fixed sample data, never real Finding data", async () => {
    const { renderMessageTemplatePreview } = await import("./messageTemplates");
    const rendered = renderMessageTemplatePreview("{{rule}} found in {{file}} ({{repo}})");
    expect(rendered).toBe("AWS Access Key found in src/config.js (octocat/example-repo)");
  });

  it("does not append the attribution line when includeAttributionLine is falsy/omitted", async () => {
    const { renderMessageTemplatePreview } = await import("./messageTemplates");
    const rendered = renderMessageTemplatePreview("{{rule}}");
    expect(rendered).not.toContain("support this project");
  });

  it("appends the fixed attribution line when includeAttributionLine is true", async () => {
    const { renderMessageTemplatePreview } = await import("./messageTemplates");
    const rendered = renderMessageTemplatePreview("{{rule}}", true);
    expect(rendered).toContain("If you'd like to support this project, visit:");
    expect(rendered).toContain("https://github.com/TODO-project-org/secretwatch");
  });
});

describe("createMessageTemplate — variant fields", () => {
  it("defaults severity/secretType to null and includeAttributionLine to false when omitted", async () => {
    const { createMessageTemplate } = await import("./messageTemplates");
    const template = await createMessageTemplate({ name: "Plain", body: "{{repo}}" });
    expect(template.severity).toBeNull();
    expect(template.secretType).toBeNull();
    expect(template.includeAttributionLine).toBe(false);
  });

  it("persists severity, secretType, and includeAttributionLine when provided", async () => {
    const { createMessageTemplate } = await import("./messageTemplates");
    const template = await createMessageTemplate({
      name: "Critical AWS",
      body: "{{repo}}",
      severity: "CRITICAL" as any,
      secretType: "AWS_KEY" as any,
      includeAttributionLine: true,
    });
    expect(template.severity).toBe("CRITICAL");
    expect(template.secretType).toBe("AWS_KEY");
    expect(template.includeAttributionLine).toBe(true);
  });
});

describe("updateMessageTemplate — variant fields", () => {
  it("updates severity/secretType/includeAttributionLine independently of name/body", async () => {
    const { updateMessageTemplate } = await import("./messageTemplates");
    const updated = await updateMessageTemplate("custom1", {
      severity: "HIGH" as any,
      secretType: "GITHUB_TOKEN" as any,
      includeAttributionLine: true,
    });
    expect(updated.severity).toBe("HIGH");
    expect(updated.secretType).toBe("GITHUB_TOKEN");
    expect(updated.includeAttributionLine).toBe(true);
    expect(updated.name).toBe("Custom Template");
  });

  it("can clear severity/secretType back to null", async () => {
    resetFakeDb([makeRow({ id: "custom1", severity: "LOW", secretType: "DB_CONNECTION_STRING" })]);
    const { updateMessageTemplate } = await import("./messageTemplates");
    const updated = await updateMessageTemplate("custom1", { severity: null, secretType: null });
    expect(updated.severity).toBeNull();
    expect(updated.secretType).toBeNull();
  });
});
