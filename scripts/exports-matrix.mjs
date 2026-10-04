// The exports-conditions matrix test shared by the three packages
// (packages/*/test/exports-matrix.test.mjs, gate steps pkg:<dir>:exports).
//
// A package's test passes its expected table: for every subpath of its
// package.json "exports", the file each condition set resolves to at runtime,
// and the declaration file TypeScript resolves to (or null: untyped). The
// table is checked three ways, from a throwaway consumer whose node_modules
// links the package (resolution as a dependent sees it, not a self-reference):
//
//   runtime, every condition set — esbuild's resolver (platform "neutral", so
//     no condition is implied: only the set plus "import" and "default");
//   runtime, the sets that contain "node" — Node's own resolver
//     (`node --conditions=…` + import.meta.resolve; Node always has "node");
//   types, every condition set — TypeScript's resolveModuleName
//     (moduleResolution "bundler", customConditions = the set; TypeScript adds
//     "types" and "import"; a resolved .js file counts as untyped, as TS7016 does).
//
// It also checks that the table covers exactly the package's subpaths and
// that every resolved file exists (build packages/blocks first: `pnpm build`).
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { after, before, describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const ts = require("typescript");

/** The condition sets of the matrix, by name. */
export const CONDITION_SETS = {
  default: [],
  development: ["development"],
  browser: ["browser"],
  "browser+development": ["browser", "development"],
  node: ["node"],
  "node+development": ["node", "development"],
  // a test runner with a DOM (vitest + jsdom) resolves with both
  "browser+node+development": ["browser", "node", "development"]
};

/**
 * @param {URL} packageUrl the package directory
 * @param {Record<string, { runtime: string | Record<string, string>, types: string | null }>} table
 *   per subpath: the runtime target (one for every set, or one per set name)
 *   and the types target (null: TypeScript finds no declarations)
 */
export function exportsMatrix(packageUrl, table) {
  const pkgDir = realpathSync(fileURLToPath(packageUrl));
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  let consumer;

  before(() => {
    consumer = mkdtempSync(join(tmpdir(), "exports-matrix-"));
    const link = join(consumer, "node_modules", ...pkg.name.split("/"));
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(pkgDir, link, "dir");
  });
  after(() => rmSync(consumer, { recursive: true, force: true }));

  const specifier = subpath => (subpath === "." ? pkg.name : `${pkg.name}/${subpath.slice(2)}`);
  const local = file =>
    file ? "./" + relative(pkgDir, realpathSync(file)).split(sep).join("/") : null;
  const expected = (entry, set) =>
    typeof entry.runtime === "string" ? entry.runtime : entry.runtime[set];

  describe(`${pkg.name}: exports conditions`, () => {
    it("the table covers exactly the package's subpaths", () => {
      assert.deepEqual(Object.keys(table).sort(), Object.keys(pkg.exports).sort());
      for (const [subpath, entry] of Object.entries(table))
        if (typeof entry.runtime !== "string")
          assert.deepEqual(
            Object.keys(entry.runtime).sort(),
            Object.keys(CONDITION_SETS).sort(),
            subpath
          );
    });

    for (const [subpath, entry] of Object.entries(table)) {
      const spec = specifier(subpath);
      describe(spec, () => {
        for (const [set, conditions] of Object.entries(CONDITION_SETS)) {
          it(`runtime [${set}]: esbuild`, async () => {
            const file = await esbuildResolve(spec, consumer, conditions);
            assert.equal(local(file), expected(entry, set));
            assert.ok(existsSync(file), `${file} does not exist (build first)`);
          });
          if (conditions.includes("node"))
            it(`runtime [${set}]: node`, () => {
              assert.equal(local(nodeResolve(spec, consumer, conditions)), expected(entry, set));
            });
          if (subpath !== "./package.json")
            it(`types [${set}]: typescript`, () => {
              const file = typesResolve(spec, consumer, conditions);
              assert.equal(local(file), entry.types);
            });
        }
      });
    }
  });
}

async function esbuildResolve(spec, resolveDir, conditions) {
  let resolved;
  await esbuild.build({
    entryPoints: ["probe"],
    bundle: true,
    write: false,
    platform: "neutral",
    conditions,
    logLevel: "silent",
    plugins: [
      {
        name: "probe",
        setup(build) {
          build.onResolve({ filter: /^probe$/ }, () => ({ path: "probe", namespace: "probe" }));
          build.onLoad({ filter: /.*/, namespace: "probe" }, async () => {
            resolved = await build.resolve(spec, { kind: "import-statement", resolveDir });
            return { contents: "" };
          });
        }
      }
    ]
  });
  assert.deepEqual(resolved.errors, [], `esbuild could not resolve ${spec}`);
  return resolved.path;
}

function nodeResolve(spec, cwd, conditions) {
  const flags = conditions.filter(c => c !== "node").map(c => `--conditions=${c}`);
  const url = execFileSync(
    process.execPath,
    [
      ...flags,
      "--input-type=module",
      "-e",
      `process.stdout.write(import.meta.resolve(${JSON.stringify(spec)}))`
    ],
    { cwd, encoding: "utf8" }
  );
  return fileURLToPath(url);
}

function typesResolve(spec, consumer, conditions) {
  const { resolvedModule } = ts.resolveModuleName(
    spec,
    join(consumer, "index.ts"),
    {
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      customConditions: conditions
    },
    ts.sys
  );
  // a JavaScript file is what TypeScript reports as untyped (TS7016)
  const file = resolvedModule?.resolvedFileName;
  return file && /\.d\.[mc]?ts$/.test(file) ? file : null;
}
