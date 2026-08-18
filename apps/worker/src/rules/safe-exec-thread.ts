/**
 * Dedicated worker_threads entry point for regex evaluation
 * (apps/worker/src/rules/safe-exec.ts). Runs in complete isolation from the
 * main scanner event loop so a catastrophic-backtracking pattern can only
 * ever hang this one disposable thread — never the scanner itself — and the
 * caller's timeout + terminate() reclaims it.
 *
 * Deliberately has NO imports from the rest of the app: it must stay a tiny,
 * self-contained script since it is loaded directly by `new Worker(...)`.
 */
import { parentPort } from "node:worker_threads";

interface ExecRequest {
  id: number;
  pattern: string;
  snippet: string;
}

interface ExecResponse {
  id: number;
  result: { fullMatch: string; group1: string | undefined } | null;
}

if (!parentPort) {
  throw new Error("safe-exec-thread.ts must be run as a worker_thread");
}

parentPort.on("message", (msg: ExecRequest) => {
  let response: ExecResponse;
  try {
    const regex = new RegExp(msg.pattern);
    const match = regex.exec(msg.snippet);
    response = {
      id: msg.id,
      result: match ? { fullMatch: match[0], group1: match[1] } : null,
    };
  } catch {
    // Malformed pattern reaching this far should be impossible
    // (apps/web/lib/scanRules.ts validates at write-time), but never let a
    // bad pattern crash the thread either way.
    response = { id: msg.id, result: null };
  }
  parentPort!.postMessage(response);
});
