// The Vite plugin: placement, the fast skip, source maps chained through Vite
// to the JSX compiler's, and the differential no-op over Solid's own compiler
// fixtures.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { devServer } from "./server.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import blocks, { transform } from "../src/index.js";

const app = fileURLToPath(new URL("./fixtures/app/", import.meta.url));
const repo = fileURLToPath(new URL("../../../", import.meta.url));

describe("blocks()", () => {
  const plugin = blocks();
  const run = (code, id) => plugin.transform.call({}, code, id);

  it("runs before the JSX compiler", () => {
    expect(plugin.enforce).toBe("pre");
    expect(plugin.name).toBe("vite-plugin-solid-blocks");
  });

  it("skips a module with no function* without parsing it", () => {
    // not even valid syntax: a parse would throw
    expect(run("const a = <p>{yield* x</p>", "/src/a.tsx")).toBeNull();
  });

  it("skips virtual modules, non-scripts and node_modules", () => {
    const code = "function* v() { return <p>{yield* x}</p>; }";
    expect(run(code, "\0virtual:x.tsx")).toBeNull();
    expect(run(code, "/src/a.css")).toBeNull();
    expect(run(code, "/root/node_modules/lib/a.jsx")).toBeNull();
    expect(run(code, "/src/a.tsx?v=123").code).toContain("_$perform(x)");
  });

  it("takes the blocks module and a filter", () => {
    const code = "function* v() { return <p>{yield* x}</p>; }";
    const custom = blocks({ blocksModule: "my-blocks", filter: f => f.endsWith(".view.tsx") });
    expect(custom.transform.call({}, code, "/src/a.tsx")).toBeNull();
    expect(custom.transform.call({}, code, "/src/a.view.tsx").code).toContain('from "my-blocks"');
  });
});

describe("source maps through Vite", () => {
  let server;
  beforeAll(async () => {
    server = await devServer(app);
  });
  afterAll(() => server?.close());

  /** 1-based line and column of `needle` in the authored fixture. */
  const authored = needle => {
    const lines = readFileSync(join(app, "Card.tsx"), "utf8").split("\n");
    const line = lines.findIndex(l => l.includes(needle));
    return `Card.tsx:${line + 1}:${lines[line].indexOf(needle) + 1}`;
  };

  it("renders through the plugin and the compiler", async () => {
    const mod = await server.ssrLoadModule("/Card.tsx");
    expect(mod.page(2)).toContain("<h2>Cart</h2>");
  });

  it("a runtime error in a hole maps to the authored line and column", async () => {
    const mod = await server.ssrLoadModule("/Card.tsx");
    let error;
    try {
      mod.page(-1);
    } catch (e) {
      error = e;
    }
    // a plain throw in a block is a bug, reported as such (D-019); the
    // original error is its cause
    expect(error.message).toMatch(/^\[UNTYPED_THROW\] a view in <Card\d*>: deliberate/);
    const cause = error.cause;
    server.ssrFixStacktrace(cause);
    const frames = cause.stack.split("\n").filter(l => l.includes("Card.tsx:"));
    // the throw, its caller, and the hole that called it — on a line whose
    // `yield*`s the plugin rewrote, after the one-line shift of the import
    expect(frames[0]).toContain(authored("new Error(`deliberate"));
    expect(frames[1]).toContain(authored("fail(`negative"));
    expect(frames[2]).toContain(authored("label(yield* props.n)"));
  });
});

describe("differential no-op", () => {
  // Every fixture of Solid's own JSX compilers has no `yield*` in JSX, so the
  // plugin must leave each one alone (null: byte-identical by not answering).
  const dirs = [
    "packages/babel-plugin/test",
    "packages/compiler/__tests__",
    "packages/compiler/tests"
  ].filter(d => existsSync(join(repo, d)));
  const files = dirs.length
    ? execFileSync("git", ["ls-files", ...dirs], { cwd: repo, encoding: "utf8" })
        .split("\n")
        .filter(f => /\.[mc]?[jt]sx?$/.test(f))
    : [];

  it.skipIf(!files.length)(`transform() is null for each of Solid's compiler fixtures`, () => {
    const changed = files.filter(f =>
      transform(readFileSync(join(repo, f), "utf8"), { filename: join(repo, f) })
    );
    expect(changed).toEqual([]);
    expect(files.length).toBeGreaterThan(600);
  });
});
