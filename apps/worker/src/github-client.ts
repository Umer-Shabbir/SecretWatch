import { Octokit } from "@octokit/rest";
import { decrypt } from "./token-crypto";
import { prisma } from "./db";

/**
 * Thrown by createGithubIssue on any non-2xx GitHub REST response. Carries
 * only the HTTP status — never the request/response body, which could echo
 * back the Authorization header or other sensitive context in a thrown
 * library error.
 */
export class GithubApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "GithubApiError";
  }
}

/**
 * Parses and updates the rate limit stats from GitHub response headers.
 */
async function updateRateLimitsFromHeaders(tokenId: string, headers: Record<string, string | number | undefined>) {
  if (!headers) return;

  const remainingHeader = headers["x-ratelimit-remaining"];
  const resetHeader = headers["x-ratelimit-reset"];

  const data: { rateLimitRemaining?: number; rateLimitResetAt?: Date } = {};

  if (remainingHeader !== undefined && remainingHeader !== null) {
    const remaining = parseInt(String(remainingHeader), 10);
    if (!isNaN(remaining)) {
      data.rateLimitRemaining = remaining;
    }
  }

  if (resetHeader !== undefined && resetHeader !== null) {
    const resetSeconds = parseInt(String(resetHeader), 10);
    if (!isNaN(resetSeconds)) {
      data.rateLimitResetAt = new Date(resetSeconds * 1000);
    }
  }

  if (Object.keys(data).length > 0) {
    try {
      await prisma.githubToken.update({
        where: { id: tokenId },
        data,
      });
    } catch (err) {
      console.error(`[github-client] Failed to update rate limit for token ${tokenId}:`, err);
    }
  }
}

/**
 * GitHub code search wrapper (ARCHITECTURE.md §5/§6).
 *
 * SECURITY: the decrypted token lives only in the local `token` variable
 * inside `withGithubClient` for the duration of the call — it is passed
 * directly to Octokit's constructor and never assigned to a module-level
 * variable, logged, or included in any thrown error. Never log
 * `encryptedToken` or the decrypted value in this file.
 */

export interface CodeSearchResult {
  repoFullName: string;
  filePath: string;
  /** GitHub code search does not return a commit SHA directly per-item in all API versions; we resolve it from `sha` (the blob SHA returned by the Search API) — see note in scanner.worker.ts about what "commitSha" means here. */
  sha: string;
  /** Raw text content of the matching fragment(s) for this file, as returned by the Search API's text-match metadata. */
  fragments: string[];
  htmlUrl: string;
}

/**
 * Simple in-process token-bucket throttle for GitHub's authenticated Search
 * API rate limit (~30 requests/minute, ARCHITECTURE.md §5). This is
 * intentionally minimal (single-process, in-memory) — sufficient for one
 * worker instance; would need a shared/Redis-backed limiter if the worker
 * is ever scaled to multiple replicas.
 */
export class SearchRateLimiter {
  private timestamps: number[] = [];
  constructor(
    private readonly maxRequests = 30,
    private readonly windowMs = 60_000
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 50;
      await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 0)));
      return this.acquire();
    }

    this.timestamps.push(now);
  }
}

export const searchRateLimiter = new SearchRateLimiter();

/**
 * Runs `fn` with an Octokit client authenticated as the decrypted token.
 * Decryption happens in-memory only for the lifetime of this call.
 */
export async function withGithubClient<T>(
  encryptedToken: string,
  tokenId: string,
  fn: (octokit: Octokit) => Promise<T>
): Promise<T> {
  const token = decrypt(encryptedToken);
  const octokit = new Octokit({ auth: token });

  octokit.hook.after("request", async (response) => {
    if (response?.headers) {
      await updateRateLimitsFromHeaders(tokenId, response.headers as Record<string, string | number | undefined>);
    }
  });

  octokit.hook.error("request", async (error) => {
    if ((error as any).response?.headers) {
      await updateRateLimitsFromHeaders(tokenId, (error as any).response.headers as Record<string, string | number | undefined>);
    }
    throw error;
  });

  try {
    return await fn(octokit);
  } finally {
    // Nothing to zero out explicitly — `token` and `octokit`'s internal auth
    // closure fall out of scope here and are not referenced anywhere else.
  }
}

/**
 * Executes a single GitHub code search query (one page), respecting the
 * in-process rate limiter. Returns lightweight result rows only — never
 * attempts to extract/store the actual secret value here, that's the rule
 * engine's job against `fragments`.
 */
export async function searchCode(
  encryptedToken: string,
  tokenId: string,
  query: string,
  page = 1,
  perPage = 30
): Promise<CodeSearchResult[]> {
  await searchRateLimiter.acquire();

  return withGithubClient(encryptedToken, tokenId, async (octokit) => {
    const response = await octokit.rest.search.code({
      q: query,
      page,
      per_page: perPage,
      // headers request text-match metadata so we get the actual matching
      // code fragment, not just file identity.
      headers: { accept: "application/vnd.github.v3.text-match+json" },
    });

    type SearchCodeItem = (typeof response.data.items)[number];

    return response.data.items.map((item: SearchCodeItem) => {
      const textMatches = (item as unknown as { text_matches?: Array<{ fragment?: string }> }).text_matches ?? [];
      return {
        repoFullName: item.repository!.full_name,
        filePath: item.path,
        sha: item.sha,
        fragments: textMatches.map((m) => m.fragment ?? "").filter(Boolean),
        htmlUrl: item.html_url,
      };
    });
  });
}

export interface CreatedIssue {
  htmlUrl: string;
  number: number;
}

/**
 * Opens a GitHub issue on `owner/repo` using the decrypted token, per
 * ARCHITECTURE.md §5 ("posts issue via GitHub REST API POST
 * /repos/{owner}/{repo}/issues"). Used by the flagger worker (M07).
 *
 * Throws GithubApiError on any non-2xx response (rate limit 403/429, repo
 * not found 404, repo archived 410, etc.) so the caller can classify the
 * failure into a short, non-secret display reason without ever surfacing
 * the raw Octokit error (which could include request headers).
 */
export async function createGithubIssue(
  encryptedToken: string,
  tokenId: string,
  owner: string,
  repo: string,
  title: string,
  body: string
): Promise<CreatedIssue> {
  return withGithubClient(encryptedToken, tokenId, async (octokit) => {
    try {
      const response = await octokit.rest.issues.create({ owner, repo, title, body });
      return { htmlUrl: response.data.html_url, number: response.data.number };
    } catch (err: unknown) {
      const status = extractStatus(err);
      throw new GithubApiError(status, `GitHub issue creation failed with status ${status}`);
    }
  });
}

function extractStatus(err: unknown): number {
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return 500;
}
