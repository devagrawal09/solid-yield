const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { spawnSync } = require("node:child_process");
test("CLI reads tsconfig selection and exits nonzero with an authored diagnostic", () => {
  const dir = path.join(__dirname, ".native-generated", "cli-" + process.pid);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "counter.tsx"), require("./cases.cjs")[0].source);
  fs.writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        skipLibCheck: true,
        jsx: "preserve",
        types: [],
        plugins: [{ name: "ts-plugin-solid-yield", mode: "native", include: ["*.tsx"] }]
      },
      include: ["*.tsx"]
    })
  );
  try {
    const result = spawnSync(
      process.execPath,
      [path.join(__dirname, "../src/cli.cjs"), "check", dir],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /counter\.tsx:4:17 error TS2769: \[READ_IN_SETUP\]/);
    fs.writeFileSync(
      path.join(dir, "counter.tsx"),
      require("./cases.cjs")[0].source.replace("const value = count();", "const value = 1;")
    );
    const fixed = spawnSync(
      process.execPath,
      [path.join(__dirname, "../src/cli.cjs"), "check", dir],
      { encoding: "utf8" }
    );
    assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
    assert.match(fixed.stdout, /0 errors/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("CLI: usage for another command or no directory; a stack and 1 when it cannot check", () => {
  const cli = args =>
    spawnSync(process.execPath, [path.join(__dirname, "../src/cli.cjs"), ...args], {
      encoding: "utf8"
    });
  for (const args of [[], ["check"], ["lint", "."]]) {
    const result = cli(args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^Usage: solid-yield check <dir> \[--native <include-glob>\]/);
  }
  const nowhere = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "sy-cli-"));
  try {
    const missing = cli(["check", nowhere]);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /^Error: No tsconfig\.json found\.\n {4}at check/);
    // a TypeScript error with a message chain is printed whole (it crashed the check)
    fs.writeFileSync(
      path.join(nowhere, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { strict: true, noEmit: true, types: [] },
        include: ["*.ts"]
      })
    );
    fs.writeFileSync(
      path.join(nowhere, "a.ts"),
      "function f(cb: (a: { k: number }) => void) { return cb; }\nf((a: { k: string }) => {});\n"
    );
    const chained = cli(["check", nowhere]);
    assert.equal(chained.status, 1, chained.stderr);
    assert.match(
      chained.stdout,
      /a\.ts:2:3 error TS2345: .*\n {2}Types of parameters 'a' and 'a' are incompatible\./
    );
    assert.match(chained.stdout, /1 files, 1 errors/);
  } finally {
    fs.rmSync(nowhere, { recursive: true, force: true });
  }
});
