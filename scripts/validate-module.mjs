import fs from "node:fs";
import path from "node:path";

const [, , moduleId] = process.argv;
if (!moduleId) {
  console.error("Usage: node scripts/validate-module.mjs M04");
  process.exit(2);
}

const statePath = path.join(process.cwd(), "state", "modules", `${moduleId}.json`);
if (!fs.existsSync(statePath)) {
  console.error(`Unknown module: ${moduleId}`);
  process.exit(3);
}

const s = JSON.parse(fs.readFileSync(statePath, "utf8"));
const required = ["id", "name", "status", "dependencies", "changedFiles", "checks"];
for (const key of required) {
  if (!(key in s)) {
    console.error(`Missing state field: ${key}`);
    process.exit(4);
  }
}

if (s.status === "DONE") {
  if (!Array.isArray(s.checks) || s.checks.length === 0) {
    console.error("DONE module must have checks recorded.");
    process.exit(5);
  }
}

console.log(`VALID ${moduleId}`);
