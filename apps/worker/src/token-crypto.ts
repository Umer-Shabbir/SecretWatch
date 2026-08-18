import crypto from "node:crypto";

/**
 * AES-256-GCM decryption for GitHub tokens at rest — worker-side copy.
 *
 * This is intentionally a copy of the decrypt half of
 * apps/web/lib/token-crypto.ts, NOT a re-implementation with a different
 * scheme. Byte-for-byte same algorithm/format so ciphertext produced by the
 * web app's `encrypt()` decrypts correctly here:
 *
 *   base64( 1-byte version | 12-byte iv | 16-byte authTag | ciphertext )
 *
 * Why copied instead of imported: apps/worker and apps/web are separate
 * npm workspace packages; apps/web is a Next.js application (not published
 * with a package "exports"/"main" surface intended for cross-package
 * import, and importing its /lib files would pull Next.js-only build
 * assumptions into a plain Node worker process). Moving the module into
 * packages/shared was considered but rejected for this pass to avoid
 * touching a file owned by M03 beyond what CLAUDE.md section 4 allows
 * ("do not touch M02/M03 files beyond what's needed for reuse"). If a
 * future module needs this from a third package, promote both copies to
 * packages/shared in one coordinated change with a migration note in both
 * modules' change logs.
 *
 * Only `decrypt()` is copied — the worker never creates new encrypted rows,
 * only reads/uses existing ones in-memory, so `encrypt()`/`maskToken()` are
 * intentionally omitted here.
 *
 * SECURITY: never console.log/console.error/throw an Error containing
 * plaintext or decrypted token values anywhere in this file or its callers.
 */

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION = 1;
const ALGORITHM = "aes-256-gcm";

function loadKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function decrypt(ciphertextBlob: string): string {
  if (!ciphertextBlob || typeof ciphertextBlob !== "string") {
    throw new Error("decrypt() requires a non-empty string");
  }

  let blob: Buffer;
  try {
    blob = Buffer.from(ciphertextBlob, "base64");
  } catch {
    throw new Error("Invalid ciphertext encoding");
  }

  const minLength = 1 + IV_LENGTH + AUTH_TAG_LENGTH;
  if (blob.length <= minLength) {
    throw new Error("Invalid ciphertext blob");
  }

  const version = blob[0];
  if (version !== VERSION) {
    throw new Error("Unsupported ciphertext version");
  }

  const iv = blob.subarray(1, 1 + IV_LENGTH);
  const authTag = blob.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = blob.subarray(1 + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = loadKey();
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    throw new Error("Failed to decrypt token");
  }
}
