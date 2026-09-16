import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({
  prisma: {
    repositoryFilter: {
      findMany: vi.fn(),
    },
  },
}));

import { getActiveRepoFilters, clearRepoFiltersCache } from "../repo-filters";
import { prisma } from "../db";

describe("repo-filters cache", () => {
  beforeEach(() => {
    clearRepoFiltersCache();
    vi.clearAllMocks();
  });

  it("caches database results until TTL expires", async () => {
    const mockFilters = [{ id: "1", type: "ALLOWLIST", pattern: "org/*", enabled: true }];
    vi.mocked(prisma.repositoryFilter.findMany).mockReturnValueOnce(Promise.resolve(mockFilters) as unknown as ReturnType<typeof prisma.repositoryFilter.findMany>);

    const f1 = await getActiveRepoFilters();
    expect(f1).toEqual(mockFilters);
    expect(prisma.repositoryFilter.findMany).toHaveBeenCalledTimes(1);

    // Should return cached
    const f2 = await getActiveRepoFilters();
    expect(f2).toEqual(mockFilters);
    expect(prisma.repositoryFilter.findMany).toHaveBeenCalledTimes(1); // Still 1
  });

  it("deduplicates concurrent fetches", async () => {
    const mockFilters = [{ id: "1", type: "ALLOWLIST", pattern: "org/*", enabled: true }];
    
    // Make the DB call take a small amount of time
    vi.mocked(prisma.repositoryFilter.findMany).mockImplementationOnce(() =>
      new Promise((resolve) => setTimeout(() => resolve(mockFilters as any), 10)) as unknown as ReturnType<typeof prisma.repositoryFilter.findMany>
    );

    const promises = [
      getActiveRepoFilters(),
      getActiveRepoFilters(),
      getActiveRepoFilters()
    ];

    const results = await Promise.all(promises);
    
    expect(results[0]).toEqual(mockFilters);
    expect(results[1]).toEqual(mockFilters);
    expect(results[2]).toEqual(mockFilters);
    
    // Only one query should have been executed
    expect(prisma.repositoryFilter.findMany).toHaveBeenCalledTimes(1);
  });
});
