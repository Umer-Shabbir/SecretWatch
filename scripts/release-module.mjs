import fs from "node:fs";
import path from "node:path";

const [, , moduleId, owner] = process.argv;
if (!moduleId || !owner) {
  console.error("Usage: node scripts/release-module.mjs M04 agent-id");
  process.exit(2);
}

const root = process.cwd();
const statePath = path.join(root, "state", "modules", `${moduleId}.json`);
const lockPath = path.join(root, "state", "locks", `${moduleId}.lock`);

if (!fs.existsSync(statePath) || !fs.existsSync(lockPath)) {
  console.error(`No active lock for ${moduleId}`);
  process.exit(3);
}

const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
if (lock.owner !== owner) {
  console.error(`Cannot release ${moduleId}; owned by ${lock.owner}`);
  process.exit(4);
}

const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
if (state.status !== "DONE" && state.status !== "BLOCKED" && state.status !== "AVAILABLE") {
  console.error(`Refusing to release ${moduleId} while status is ${state.status}. Mark DONE/BLOCKED first.`);
  process.exit(5);
}

state.owner = null;
state.claimedAt = null;
fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
fs.unlinkSync(lockPath);

console.log(`RELEASED ${moduleId}`);
