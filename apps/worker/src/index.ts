import { createScannerWorker } from "./scanner.worker";
import { createFlaggerWorker } from "./flagger.worker";
import { startScheduler } from "./scheduler";

/**
 * Worker process entrypoint (ARCHITECTURE.md §6: `apps/worker`). Boots the
 * scanner worker, flagger worker (M07), and scheduler (repeatable
 * scan-enqueue tick).
 *
 * SECURITY: this process must never log decrypted GitHub tokens or matched
 * secret values — see apps/worker/src/github-client.ts and
 * apps/worker/src/rules/engine.ts for where that boundary is enforced.
 */
async function main() {
  console.log("[worker] starting scanner worker + flagger worker + scheduler...");

  const scannerWorker = createScannerWorker();
  scannerWorker.on("failed", (job, err) => {
    // Log only the error message/job id — never job.data secrets (job.data
    // only ever contains { ruleId, query } for scan-queue, never a token or
    // matched secret, but this stays defensive in case that ever changes).
    console.error(`[scanner] job ${job?.id} failed: ${err.message}`);
  });
  scannerWorker.on("completed", (job) => {
    console.log(`[scanner] job ${job.id} completed`);
  });

  const flaggerWorker = createFlaggerWorker();
  flaggerWorker.on("failed", (job, err) => {
    // job.data only ever contains { findingId } — never a token or secret.
    console.error(`[flagger] job ${job?.id} failed: ${err.message}`);
  });
  flaggerWorker.on("completed", (job) => {
    console.log(`[flagger] job ${job.id} completed`);
  });

  const { schedulerWorker } = await startScheduler();
  schedulerWorker.on("failed", (job, err) => {
    console.error(`[scheduler] job ${job?.id} failed: ${err.message}`);
  });

  console.log("[worker] ready.");

  const shutdown = async () => {
    console.log("[worker] shutting down...");
    await Promise.all([scannerWorker.close(), flaggerWorker.close(), schedulerWorker.close()]);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[worker] fatal startup error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
