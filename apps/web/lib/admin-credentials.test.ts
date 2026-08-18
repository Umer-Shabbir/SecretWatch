import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { verifyAdminCredentials } from "./admin-credentials";

describe("verifyAdminCredentials", () => {
  it("rejects a null user (unknown account)", async () => {
    await expect(verifyAdminCredentials(null, "anything")).resolves.toBe(false);
  });

  it("rejects a USER-role account even with a valid password hash", async () => {
    const hash = await bcrypt.hash("correct-horse", 10);
    const user = { id: "1", role: "USER", passwordHash: hash };
    await expect(verifyAdminCredentials(user, "correct-horse")).resolves.toBe(false);
  });

  it("rejects an ADMIN account with no password hash set (OAuth-only admin)", async () => {
    const user = { id: "1", role: "ADMIN", passwordHash: null };
    await expect(verifyAdminCredentials(user, "anything")).resolves.toBe(false);
  });

  it("rejects an ADMIN account with the wrong password", async () => {
    const hash = await bcrypt.hash("correct-horse", 10);
    const user = { id: "1", role: "ADMIN", passwordHash: hash };
    await expect(verifyAdminCredentials(user, "wrong-password")).resolves.toBe(false);
  });

  it("accepts an ADMIN account with the correct password", async () => {
    const hash = await bcrypt.hash("correct-horse", 10);
    const user = { id: "1", role: "ADMIN", passwordHash: hash };
    await expect(verifyAdminCredentials(user, "correct-horse")).resolves.toBe(true);
  });
});
