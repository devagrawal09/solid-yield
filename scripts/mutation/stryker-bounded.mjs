// Interrupting Stryker saves a partial incremental report for a narrower retry.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const [pkg, ...flags] = process.argv.slice(2);
if (!["compiler", "vite", "vite-heart", "vite-ruled"].includes(pkg))
  throw new Error("Expected compiler, vite, vite-heart or vite-ruled");
const minutesAt = flags.indexOf("--minutes");
const minutes = minutesAt < 0 ? 40 : Number(flags.splice(minutesAt, 2)[1]);
if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("Invalid time budget");
const command = [
  "scripts/mutation/tools/node_modules/@stryker-mutator/core/bin/stryker.js",
  "run",
  `scripts/mutation/stryker-${pkg}.config.mjs`,
  ...flags
];
const startedAt = new Date();
let budgetExceeded = false;
const child = spawn(process.execPath, command, { stdio: "inherit" });
const timer = setTimeout(() => {
  budgetExceeded = true;
  console.error(`Stryker ${pkg}: ${minutes}-minute budget reached; saving incremental results.`);
  child.kill("SIGINT");
}, minutes * 60_000);
child.on("exit", (code, signal) => {
  clearTimeout(timer);
  const finishedAt = new Date();
  writeFileSync(
    `documentation/mutation-stryker-${pkg}-wall.json`,
    JSON.stringify(
      {
        command: `node scripts/mutation/stryker-bounded.mjs ${pkg} ${process.argv.slice(3).join(" ")}`,
        strykerCommand: `node ${command.join(" ")}`,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        wallSeconds: (finishedAt - startedAt) / 1000,
        budgetMinutes: minutes,
        budgetExceeded,
        exitCode: code,
        signal
      },
      null,
      2
    ) + "\n"
  );
  process.exitCode = code ?? 130;
});
