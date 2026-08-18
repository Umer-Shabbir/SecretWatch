/**
 * Client-safe GitHub PAT format constant, split out of lib/tokens.ts so
 * client components (e.g. components/tokens/add-token-panel.tsx) can import
 * it without pulling lib/tokens.ts's server-only dependencies (Prisma,
 * node:crypto via lib/token-crypto.ts) into the browser bundle.
 *
 * Loose PAT format validation only — the real trust boundary is server-side
 * (POST /api/tokens re-validates with the same pattern via zod). This is
 * purely a UX hint, never a security control.
 */
export const PAT_PATTERN = /^(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{20,}$/;
