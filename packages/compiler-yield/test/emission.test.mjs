import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdtempSync, cpSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import eagerIslands from "../src/eager.js";
import { pathToFileURL } from "node:url";
import { extractModule } from "../src/emit.js";
import { capture } from "../src/capture.js";
import solidYield from "../../vite-plugin-yield/src/index.js";
const require = createRequire(new URL("../package.json", import.meta.url));
const codec = await import(pathToFileURL(require.resolve("@solidjs/web/serialization")));

test("C2 edge: use the public codec, refuse functions and class-losing errors", () => {
  const value = {
    slug: "widgets",
    when: new Date(100),
    set: new Set([1, 2]),
    map: new Map([["a", 3]])
  };
  const copied = capture(value, codec, "fixture:2:9");
  assert.equal(copied.ok, true);
  assert.deepEqual(copied.value, value);
  const fn = capture(() => 1, codec, "fixture:3:9");
  assert.equal(fn.ok, false);
  assert.equal(fn.at, "fixture:3:9");
  class NotFound extends Error {
    kind = "not-found";
  }
  let node;
  codec.serializeJSON(new NotFound("missing"), { onParse: n => (node = n) });
  const decoded = codec.createJSONDeserializer()(node);
  assert.equal(decoded.kind, "not-found");
  assert.equal(decoded instanceof NotFound, false); // F-C6, not a passing capture
  assert.equal(capture({ nested: new NotFound("missing") }, codec, "fixture:4:9").ok, false);
  assert.equal(capture(Promise.resolve(1), codec, "fixture:5:9").ok, false);
});

test("C2 modules keep dependencies, side-effect imports and only selected exports", () => {
  const source =
    'import "./styles.css";\nimport {component,view,$signal,$event} from "solid-yield";\nconst words=["one","two"];\nexport const Inert=()=>"server-only copy";\nexport const Root=component(function*(){const [n,set]=yield* $signal(0);const click=$event(function*(){yield* set(1)});return view(function*(){return <button onClick={yield* click}>{words[yield* n]}</button>});});';
  const out = extractModule(source, "/app/widgets.tsx", ["Root"]);
  assert(out.code.includes('import "./styles.css"'));
  assert(out.code.includes("const words="));
  assert(!out.code.includes("server-only copy"));
  assert(!out.code.includes("export const Root"));
  assert(out.code.includes("export { Root }"));
  assert.deepEqual(out.map.sources, ["/app/widgets.tsx"]);
});

test("C2 extraction maps chain through yield, Solid and Vite to authored frames", async () => {
  const { createServer } = await import(pathToFileURL(require.resolve("vite")));
  const solidModule = await import(pathToFileURL(require.resolve("@solidjs/vite-plugin")));
  const solid =
    typeof solidModule.default === "function" ? solidModule.default : solidModule.default.default;
  const authored = resolve(import.meta.dirname, "fixtures/emission-source.tsx");
  const emitted = resolve(import.meta.dirname, "fixtures/__emitted.tsx");
  const source =
    'import {component,view,foreign} from "solid-yield";\nimport {renderToString} from "@solidjs/web";\nconst removed=123;\nfunction fail(){\n  throw new Error("source-map-probe");\n}\nconst Root=component(function*(){\n  return view(function*(){return <p>{fail()}</p>});\n});\nexport function page(){return renderToString(()=>foreign(Root)());}\n';
  const out = extractModule(source, authored, ["page"]);
  const server = await createServer({
    root: resolve(import.meta.dirname, ".."),
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [
      {
        name: "emission-fixture",
        resolveId: id => (id === emitted ? id : null),
        load: id => (id === emitted ? out : null)
      },
      solidYield(),
      solid({ hot: false, ssr: true })
    ]
  });
  try {
    const mod = await server.ssrLoadModule(emitted);
    let failure;
    try {
      mod.page();
    } catch (e) {
      failure = e.cause ?? e;
    }
    assert(failure);
    server.ssrFixStacktrace(failure);
    assert(failure.stack.includes("emission-source.tsx:5:9"), failure.stack);
  } finally {
    await server.close();
  }
});

test("C2 unproved input falls back at its variable; one root leaves both entries unchanged", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "c2-capture-"));
  try {
    cpSync(
      resolve(import.meta.dirname, "../../../examples/docs-yield/src"),
      resolve(directory, "src"),
      { recursive: true }
    );
    const app = resolve(directory, "src/app.tsx"),
      entry = resolve(directory, "src/main.tsx");
    const original = readFileSync(app, "utf8");
    writeFileSync(
      app,
      original
        .replace("yield* ThemeToggle()", "yield* ThemeToggle(forbidden)")
        .replace("const App =", "const forbidden = () => 1;\nconst App =")
    );
    let plan;
    let plugin = eagerIslands({ directory, onPlan: p => (plan = p) });
    plugin.buildStart();
    assert.equal(plan.fallback, true);
    assert.equal(plan.diagnostics[0].variable, "forbidden");
    assert.match(plan.diagnostics[0].at, /app.tsx:\d+:\d+$/);
    assert.equal(plugin.transform("untouched", entry, { ssr: false }), null);
    assert.equal(plugin.transform("untouched", app, { ssr: true }), null);
    writeFileSync(
      app,
      'import {component,view} from "solid-yield";import {ThemeToggle} from "./widgets"; const App=component(function*(){return view(function*(){return <div>{yield* ThemeToggle()}</div>})}); export default App;'
    );
    plugin = eagerIslands({ directory, onPlan: p => (plan = p) });
    plugin.buildStart();
    assert.equal(plan.fallback, true);
    assert.match(plan.diagnostics[0].reason, /one physical root/);
    assert.equal(plugin.transform("byte-identical", entry, { ssr: false }), null);
    assert.equal(plugin.transform("byte-identical", app, { ssr: true }), null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("single root retains C1 groups, strips inert imports and chains both edit maps", () => {
  const directory = resolve(import.meta.dirname, "../../../examples/docs-yield");
  let plan;
  const plugin = eagerIslands({ directory, roots: "single", onPlan: p => (plan = p) });
  plugin.buildStart();
  assert.equal(plan.report.roots.length, 11);
  assert.equal(plan.roots.length, 1);
  assert.equal(new Set(plan.roots[0].groups).size, 11);
  assert.deepEqual(plugin.config(), {}, "no per-group chunk boundaries");
  const module = plan.roots[0].module;
  const loaded = plugin.load(module);
  const transformed = plugin.transform(loaded.code, module, { ssr: false });
  assert.equal(
    loaded.map.sourcesContent[0],
    readFileSync(resolve(directory, "src/app.tsx"), "utf8")
  );
  assert.equal(transformed.map.sourcesContent[0], loaded.code);
  assert(!/SiteNav|SiteFooter/.test(transformed.code), "inert component imports are absent");
  const entry = plugin.load(resolve(directory, "src/__compiler_client.tsx")).code;
  assert.equal([...entry.matchAll(/\bhydrate\(/g)].length, 1);
  assert.equal([...entry.matchAll(/createJSONDeserializer\(\)/g)].length, 1);
  assert.throws(() => eagerIslands({ directory, roots: "unknown" }), /Unknown eager roots mode/);
});
