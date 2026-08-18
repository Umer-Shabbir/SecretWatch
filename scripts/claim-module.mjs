import fs from "node:fs";
import path from "node:path";

const [, , moduleId, owner] = process.argv;
if (!moduleId || !owner) {
  console.error("Usage: node scripts/claim-module.mjs M04 agent-id");
  process.exit(2);
}

const root = process.cwd();
const statePath = path.join(root, "state", "modules", `${moduleId}.json`);
const lockDir = path.join(root, "state", "locks");
const lockPath = path.join(lockDir, `${moduleId}.lock`);

if (!fs.existsSync(statePath)) {
  console.error(`Unknown module: ${moduleId}`);
  process.exit(3);
}

fs.mkdirSync(lockDir, { recursive: true });

try {
  // wx is atomic at the filesystem level: only one claimant can create the lock.
  const fd = fs.openSync(lockPath, "wx");
  const lock = {
    moduleId,
    owner,
    pid: process.pid,
    claimedAt: new Date().toISOString()
  };
  fs.writeFileSync(fd, JSON.stringify(lock, null, 2));
  fs.closeSync(fd);

  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  if (state.owner && state.owner !== owner && state.status !== "AVAILABLE") {
    fs.unlinkSync(lockPath);
    console.error(`Module ${moduleId} is already owned by ${state.owner}.`);
    process.exit(4);
  }

  state.owner = owner;
  state.claimedAt = lock.claimedAt;
  state.status = "CLAIMED";
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");

  console.log(`CLAIMED ${moduleId} by ${owner}`);
} catch (err) {
  if (err.code === "EEXIST") {
    const existing = fs.readFileSync(lockPath, "utf8");
    console.error(`LOCKED ${moduleId}: ${existing}`);
    process.exit(5);
  }
  throw err;
}
