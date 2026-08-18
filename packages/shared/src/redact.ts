/**
 * Secret redaction. SECURITY CRITICAL (ARCHITECTURE.md §4/§8, PRODUCT_SOURCE_OF_TRUTH.md
 * "Core security behavior"): the raw secret substring must never appear in
 * anything persisted to the database, logged, or returned by an API.
 *
 * redactSecret() takes the full matched line/snippet plus the exact matched
 * secret substring within it, and returns a version of the snippet with the
 * secret masked. Only a short prefix/suffix of the secret is preserved (for
 * admin recognizability), matching the masking style already used for
 * GithubToken in apps/web/lib/token-crypto.ts (maskToken).
 */

const VISIBLE_PREFIX = 4;
const VISIBLE_SUFFIX = 4;
const MIN_MASKED_LENGTH_TO_SHOW_EDGES = 12;

/**
 * Masks a single secret value, e.g. "AKIAABCDEFGHIJKLMNOP" ->
 * "AKIA••••••••••••MNOP". Short secrets (below MIN_MASKED_LENGTH_TO_SHOW_EDGES)
 * are fully masked with no visible characters, so brute-forcing via edge
 * leakage isn't meaningfully easier than the full secret.
 */
export function maskSecretValue(secret: string): string {
  if (!secret) return "";
  if (secret.length < MIN_MASKED_LENGTH_TO_SHOW_EDGES) {
    return "•".repeat(Math.max(secret.length, 8));
  }
  const prefix = secret.slice(0, VISIBLE_PREFIX);
  const suffix = secret.slice(-VISIBLE_SUFFIX);
  const maskedLength = Math.max(secret.length - VISIBLE_PREFIX - VISIBLE_SUFFIX, 6);
  return `${prefix}${"•".repeat(maskedLength)}${suffix}`;
}

/**
 * Replaces every occurrence of `matchedSecret` inside `snippet` with its
 * masked form and clamps the overall snippet length so oversized code lines
 * can't be used to smuggle extra unredacted context into storage.
 *
 * Returns a snippet that is guaranteed not to contain `matchedSecret` as a
 * substring (asserted by callers' tests), as long as matchedSecret is
 * non-empty.
 */
export function redactSnippet(snippet: string, matchedSecret: string, maxLength = 240): string {
  if (!matchedSecret) {
    // Nothing to redact against — fail closed: do not persist arbitrary
    // unredacted content when a rule fails to isolate the exact secret span.
    return "[unredactable: no secret span isolated]";
  }

  const masked = maskSecretValue(matchedSecret);
  const replaced = snippet.split(matchedSecret).join(masked);

  return clamp(replaced, maxLength);
}

function clamp(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}
