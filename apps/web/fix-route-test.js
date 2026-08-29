const fs = require("fs");
const path = require("path");

const filePath = path.join(
  "g:",
  "SecretWatch",
  "apps",
  "web",
  "app",
  "api",
  "scan-rules",
  "[id]",
  "route.test.ts"
);

let content = fs.readFileSync(filePath, "utf8");

const deleteTests = `
describe("DELETE /api/scan-rules/:id — authorization", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { DELETE } = await import("./route");
    const res = await DELETE(new Request("http://localhost/"), { params: { id: "r1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin USER", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { DELETE } = await import("./route");
    const res = await DELETE(new Request("http://localhost/"), { params: { id: "r1" } });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/scan-rules/:id — successful deletion", () => {
  it("deletes the rule and records an audit log entry", async () => {
    const { DELETE } = await import("./route");
    
    // Add delete mock to our fake db
    sharedPrisma.scanRule.delete = vi.fn(async ({ where }) => {
      const idx = rows.findIndex((r) => r.id === where.id);
      if (idx === -1) throw new Error("not found");
      const deleted = rows[idx];
      rows.splice(idx, 1);
      return deleted;
    });

    const res = await DELETE(new Request("http://localhost/"), { params: { id: "r1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "scan_rule_deleted", detail: "scanRuleId=r1" })
    );
  });
  
  it("returns 404 for a nonexistent id", async () => {
    const { DELETE } = await import("./route");
    
    // Add delete mock to our fake db
    sharedPrisma.scanRule.delete = vi.fn(async ({ where }) => {
      const idx = rows.findIndex((r) => r.id === where.id);
      if (idx === -1) throw new Error("not found");
      const deleted = rows[idx];
      rows.splice(idx, 1);
      return deleted;
    });

    const res = await DELETE(new Request("http://localhost/"), { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });
});
`;

if (!content.includes("DELETE /api/scan-rules/:id")) {
  fs.writeFileSync(filePath, content + "\n" + deleteTests);
  console.log("Added DELETE tests");
}
