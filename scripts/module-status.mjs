import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "state", "modules");
const files = fs.readdirSync(dir).filter(x => x.endsWith(".json")).sort();

for (const file of files) {
  const state = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  console.log(
    `${state.id} | ${state.status.padEnd(11)} | ${(state.owner ?? "-").padEnd(28)} | ${state.name}`
  );
}
