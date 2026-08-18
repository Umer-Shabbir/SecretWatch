/**
 * Shannon entropy scoring, used to reduce false positives on the "Generic
 * High-Entropy String" rule (plain regex shape alone matches too much
 * ordinary code/config).
 */
export function shannonEntropy(value: string): number {
  if (!value) return 0;
  const counts = new Map<string, number>();
  for (const ch of value) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  const len = value.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Minimum bits-per-character entropy for a candidate to be treated as a real secret. */
export const ENTROPY_THRESHOLD = 3.0;

export function isHighEntropy(value: string, threshold = ENTROPY_THRESHOLD): boolean {
  return shannonEntropy(value) >= threshold;
}
