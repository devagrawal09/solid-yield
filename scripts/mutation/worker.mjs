import { readFileSync, writeFileSync, mkdirSync, symlinkSync, existsSync } from "node:fs";
import { resolve, join, dirname, relative } from "node:path";
import { createRequire } from "node:module";
import {
  lowerNativeProject,
  nativeForeignApi
} from "../../packages/vite-plugin-yield/src/native.js";
import { locate } from "../../packages/vite-plugin-yield/src/positions.js";
const root = resolve(import.meta.dirname, "../..");
const require = createRequire(join(root, "packages/vite-plugin-yield/package.json"));
const ts = require("typescript");
const { check } = createRequire(join(root, "packages/ts-plugin-yield/package.json"))(
  "./src/cli.cjs"
);
const lintRequire = createRequire(join(root, "examples/harness/package.json"));
const { ESLint } = lintRequire("eslint"),
  parser = lintRequire("@typescript-eslint/parser"),
  plugin = lintRequire("eslint-plugin-solid-yield").default;
const options = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  target: "ESNext",
  module: "ESNext",
  moduleResolution: "Bundler",
  jsx: "preserve",
  jsxImportSource: "solid-yield",
  jsxFactory: "jsx",
  jsxFragmentFactory: "Fragment",
  types: [],
  lib: ["ESNext", "DOM"]
};
function prepare(where, files) {
  mkdirSync(where, { recursive: true });
  if (!existsSync(join(where, "node_modules")))
    symlinkSync(join(root, "packages/vite-plugin-yield/node_modules"), join(where, "node_modules"));
  const paths = new Map();
  for (const [file, source] of files) {
    const path = join(where, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
    paths.set(path, source);
  }
  writeFileSync(
    join(where, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: options,
      include: ["**/*.tsx", "**/*.ts"],
      exclude: ["node_modules"]
    })
  );
  return paths;
}
/** One pipeline: transform, `solid-yield check`, generated lint; writes result.json. @param {string} jobPath */
async function runJob(jobPath) {
  const job = JSON.parse(readFileSync(jobPath, "utf8"));
  const dir = dirname(jobPath),
    sourceDir = join(dir, "source"),
    generatedDir = join(dir, "generated");
  const originals = prepare(sourceDir, job.files),
    diagnostics = [],
    stages = { transform: "not-run", cli: "not-run", lint: "not-run" };
  const norm = s =>
    String(s).replaceAll(root, "<root>").replaceAll(dir.replace(root, "<root>"), "<job>");
  let lowered, cliCrash;
  try {
    lowered = lowerNativeProject(originals);
    stages.transform = "completed";
    for (const d of lowered.diagnostics)
      diagnostics.push({
        stage: "transform",
        file: relative(sourceDir, d.file),
        line: d.line,
        code: d.code,
        message: norm(d.message)
      });
  } catch (e) {
    stages.transform = "refused";
    if (e.diagnostics)
      for (const d of e.diagnostics)
        diagnostics.push({
          stage: "transform",
          file: relative(sourceDir, d.file),
          line: d.line,
          code: d.code,
          message: norm(d.message)
        });
    else if (/\[(\w+)\]/.test(e.message)) {
      const code = e.message.match(/\[(\w+)\]/)[1];
      const at = e.message.match(/\((.*):(\d+):(\d+)\)/);
      diagnostics.push({
        stage: "transform",
        file: at ? relative(sourceDir, at[1]) : (job.file ?? job.files[0][0]),
        line: at ? Number(at[2]) : 1,
        code,
        message: norm(e.message)
      });
    } else throw e;
  }
  const log = [],
    old = console.log;
  try {
    console.log = (...args) => log.push(args.join(" "));
    stages.cli = check(sourceDir, { mode: "native", include: ["**/*.tsx", "**/*.ts"] })
      ? "diagnostics"
      : "passed";
  } catch (e) {
    stages.cli = "crashed";
    cliCrash = norm(e.stack);
  } finally {
    console.log = old;
  }
  for (const row of log) {
    // A related location (where the app is rendered, the origin read) belongs
    // to the diagnostic printed before it.
    const r = row.match(/^ {2}related: (.*):(\d+):(\d+): /);
    if (r) {
      const last = diagnostics.at(-1);
      if (last?.stage === "cli")
        (last.related ??= []).push({ file: relative(sourceDir, r[1]), line: Number(r[2]) });
      continue;
    }
    // A message chain spans lines (`Type … is missing …`): the row is matched whole.
    const m = row.match(
      /^([^\n]*):(\d+):(\d+) (error|warning|suggestion|message) (TS\d+): ([\s\S]*)$/
    );
    if (m)
      diagnostics.push({
        stage: "cli",
        file: relative(sourceDir, m[1]),
        line: Number(m[2]),
        severity: m[4],
        code: m[6].match(/\[([A-Z_]+)\]/)?.[1] ?? m[5],
        tsCode: m[5],
        message: norm(m[6])
      });
  }
  if (lowered) {
    const entries = [...lowered.files].map(([file, code]) => [relative(sourceDir, file), code]);
    prepare(generatedDir, entries);
    // the Solid APIs the lowering keeps as plain Solid (D-116), for `no-foreign-reactive`
    const foreign = {};
    for (const [, code] of entries)
      for (const m of code.matchAll(/^import \{([^}]*)\} from "(solid-js|@solidjs\/web)";$/gm))
        for (const spec of m[1].split(",")) {
          const name = spec.trim().split(/\s+as\s+/)[0];
          if (name && nativeForeignApi(m[2], name)) (foreign[m[2]] ??= []).push(name);
        }
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.tsx", "**/*.ts"],
          languageOptions: {
            parser,
            parserOptions: { project: join(generatedDir, "tsconfig.json"), tsconfigRootDir: root }
          },
          plugins: { "solid-yield": plugin },
          settings: { "solid-yield": { foreign } },
          rules: plugin.configs.recommended.rules
        }
      ]
    });
    for (const [file, code] of entries) {
      const [lint] = await eslint.lintText(code, { filePath: join(generatedDir, file) });
      const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
      for (const m of lint.messages) {
        if (m.fatal || !m.ruleId) throw new Error("Lint setup failed: " + JSON.stringify(m));
        const offset = sf.getPositionOfLineAndCharacter(m.line - 1, m.column - 1),
          original = join(sourceDir, file);
        const mapped = locate(lowered.positions.get(original), offset);
        const authored = mapped
          ? ts
              .createSourceFile(file, originals.get(original), ts.ScriptTarget.Latest, true)
              .getLineAndCharacterOfPosition(mapped.sourceStart).line + 1
          : null;
        diagnostics.push({
          stage: "lint",
          file,
          line: authored,
          generatedLine: m.line,
          generated: !mapped || mapped.generated,
          severity: m.severity === 2 ? "error" : "warning",
          code: m.message.match(/\[([A-Z_]+)\]/)?.[1] ?? m.ruleId,
          ruleId: m.ruleId,
          message: norm(m.message)
        });
      }
    }
    stages.lint = diagnostics.some(d => d.stage === "lint") ? "diagnostics" : "passed";
  } else stages.lint = "blocked-by-transform";
  // typescript-eslint keeps a program per tsconfig, and every job has its own.
  parser.clearCaches?.();
  writeFileSync(
    join(dir, "result.json"),
    JSON.stringify({
      diagnostics,
      stages,
      cliOutput: log.map(norm),
      ...(cliCrash ? { cliCrash } : {})
    })
  );
}

// `--serve`: a long-lived worker taking job paths over IPC, so its parsed
// libraries and declarations stay warm across pipelines (ts-host.js); a path
// argument runs one job and exits.
if (process.argv[2] === "--serve")
  process.on("message", async ({ path }) => {
    try {
      await runJob(path);
      process.send?.({ path, ok: true });
    } catch (error) {
      process.send?.({ path, ok: false, error: String(error?.stack ?? error) });
    }
  });
else await runJob(process.argv[2]);
