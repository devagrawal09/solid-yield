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
