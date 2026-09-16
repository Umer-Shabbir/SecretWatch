import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended nonce size for GCM
const AUTH_TAG_LENGTH = 16;
const VERSION = 1;

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

export function encrypt(plaintext: string): string {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("encrypt() requires a non-empty string");
  }
  const key = loadKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const blob = Buffer.concat([Buffer.from([VERSION]), iv, authTag, ciphertext]);
  return blob.toString("base64");
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

export function maskToken(plaintext: string): string {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("maskToken() requires a non-empty string");
  }

  const prefixMatch = plaintext.match(/^(gh[a-z]_|github_pat_)/i);
  const prefix = prefixMatch ? prefixMatch[0] : "";
  const rest = plaintext.slice(prefix.length);

  const visibleTail = rest.length > 4 ? rest.slice(-4) : rest;
  const bulletCount = Math.max(rest.length - visibleTail.length, 8);

  return `${prefix}${"•".repeat(bulletCount)}${visibleTail}`;
}
