import { prisma } from "./db";
import type { RepoFilterRule } from "@secretwatch/shared";

/**
 * In-memory cache for active repository filter rules.
 * PERF-004: Cache active repository filters in worker memory with a 60-second TTL
 * to avoid repeated full queries against PostgreSQL on every scan job.
 */

const REPO_FILTER_CACHE_TTL_MS = 60_000;

interface CachedFilters {
  filters: RepoFilterRule[];
  fetchedAt: number;
}

let filterCache: CachedFilters | null = null;
let activeFetchPromise: Promise<RepoFilterRule[]> | null = null;

export async function getActiveRepoFilters(): Promise<RepoFilterRule[]> {
  const now = Date.now();

  if (filterCache && now - filterCache.fetchedAt < REPO_FILTER_CACHE_TTL_MS) {
    return filterCache.filters;
  }

  // Deduplicate concurrent database fetches
  if (!activeFetchPromise) {
    activeFetchPromise = (async () => {
      try {
        const filters: RepoFilterRule[] = await prisma.repositoryFilter.findMany({
          where: { enabled: true },
          select: { id: true, type: true, pattern: true, enabled: true },
        });

        filterCache = {
          filters,
          fetchedAt: Date.now(),
        };

        return filters;
      } catch (err) {
        // If DB fails and we have stale cache, return it rather than failing
        if (filterCache) {
          console.warn("[scanner] Failed to refresh repo filters, using stale cache:", err);
          return filterCache.filters;
        }
        throw err;
      } finally {
        activeFetchPromise = null;
      }
    })();
  }

  return activeFetchPromise;
}

export function clearRepoFiltersCache(): void {
  filterCache = null;
  activeFetchPromise = null;
}
