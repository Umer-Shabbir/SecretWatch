/**
 * Helper to validate a GitHub personal access token (PAT) against the GitHub API.
 * Calls GET /user and reads `x-oauth-scopes` to verify validity and extract scopes.
 */
export async function validateGitHubToken(token: string): Promise<{ valid: boolean; scopes: string[] }> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "SecretWatch-TokenValidator",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { valid: false, scopes: [] };
    }

    const scopesHeader = res.headers.get("x-oauth-scopes");
    const scopes = scopesHeader
      ? scopesHeader
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    return { valid: true, scopes };
  } catch {
    return { valid: false, scopes: [] };
  }
}
