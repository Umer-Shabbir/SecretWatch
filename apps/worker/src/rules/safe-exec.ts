import { Worker } from "node:worker_threads";
import path from "node:path";

/**
 * Hard wall-clock budget (ms) for evaluating one rule against one snippet.
 * Admin-supplied ScanRule.pattern values are validated for obvious
 * catastrophic-backtracking shapes at write-time (apps/web/lib/scanRules.ts),
 * but that check is a heuristic, not a proof. This timeout is the actual
 * security boundary: no pattern, however it is shaped, can hang the scanner
 * worker beyond this budget.
 * process.env.REGEX_TIMEOUT_MS overrides it (used by the test suite, which
 * runs test files in parallel worker processes and needs headroom so a
 * CPU-starved thread round-trip isn't mistaken for a hostile regex). The
 * production default stays 250ms — the real security boundary is unchanged.
 */
const REGEX_TIMEOUT_MS = Number(process.env.REGEX_TIMEOUT_MS) || 250;

let sharedWorker: Worker | null = null;
/** Resolves once the current sharedWorker has finished spinning up (tsx/cjs
 * register + module load). Thread cold-start is excluded from
 * REGEX_TIMEOUT_MS so it stays a tight bound on the regex itself, not on
 * process startup jitter. */
let workerReady: Promise<void> | null = null;
let requestId = 0;

interface PendingRequest {
  resolve: (value: RegExpExecResultShape | null) => void;
}

export interface RegExpExecResultShape {
  /** match[0] */
  fullMatch: string;
  /** match[1], if the pattern has a capture group */
  group1: string | undefined;
}

const pending = new Map<number, PendingRequest>();

function getWorker(): { worker: Worker; ready: Promise<void> } {
  if (sharedWorker && workerReady) return { worker: sharedWorker, ready: workerReady };

  // Spawned as .ts and loaded via tsx's CJS register hook, matching how this
  // whole worker process is run (package.json "dev"/"start" both invoke tsx
  // directly, no separate build/dist step). If a future build step compiles
  // to dist/, this path and the execArgv hook both need to be dropped in
  // favor of the plain compiled .js file.
  const worker = new Worker(path.join(__dirname, "safe-exec-thread.ts"), {
    execArgv: ["--require", "tsx/cjs"],
  });
  sharedWorker = worker;
  workerReady = new Promise<void>((resolveReady) => {
    worker.once("online", () => resolveReady());
  });

  worker.on("message", (msg: { id: number; result: RegExpExecResultShape | null }) => {
    const req = pending.get(msg.id);
    if (!req) return;
    pending.delete(msg.id);
    req.resolve(msg.result);
  });
  worker.on("error", (err) => {
    // A crashed regex thread must never crash the scanner. Log without any
    // pattern/snippet content (both may embed scanned code, never a raw
    // secret per engine.ts's contract, but keep this log minimal regardless)
    // and fail closed (treat as no-match) for any requests still pending.
    console.error("[rules/safe-exec] worker thread error:", err instanceof Error ? err.message : err);
    for (const req of pending.values()) req.resolve(null);
    pending.clear();
    if (sharedWorker === worker) {
      sharedWorker = null;
      workerReady = null;
    }
  });
  worker.unref();

  return { worker, ready: workerReady };
}

/**
 * Executes `pattern.exec(snippet)` on a dedicated worker thread with a hard
 * timeout. Returns null on no-match, on timeout (treated as "the rule did
 * not match in time" — fails closed, never blocks the caller), or on any
 * worker-thread failure.
 *
 * This is the actual ReDoS mitigation: apps/web/lib/scanRules.ts's
 * admin-input shape check is a best-effort filter, not a guarantee, so this
 * timeout is what keeps a hostile or missed pattern from hanging the
 * scanner regardless of shape.
 */
export async function execWithTimeout(pattern: string, snippet: string): Promise<RegExpExecResultShape | null> {
  const { worker, ready } = getWorker();
  await ready; // exclude thread cold-start from the security-critical budget below

  const id = ++requestId;

  return new Promise<RegExpExecResultShape | null>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(null);
      // A pattern that misses its budget is synchronously blocking the JS
      // event loop inside the worker thread's native regex engine call —
      // it will never yield on its own and will silently swallow every
      // future request on this thread. Terminate and let the next call spin
      // up a fresh thread; this is the only way to actually reclaim a stuck
      // worker (postMessage/close cannot interrupt an in-flight regex.exec).
      if (sharedWorker === worker) {
        sharedWorker = null;
        workerReady = null;
      }
      worker.terminate().catch(() => {});
      for (const [otherId, req] of pending) {
        pending.delete(otherId);
        req.resolve(null);
      }
    }, REGEX_TIMEOUT_MS);

    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
    });

    worker.postMessage({ id, pattern, snippet });
  });
}
