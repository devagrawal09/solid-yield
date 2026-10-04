// The lazy() module-URL pass for the library's `lazy` (D-047): the same
// annotation @solidjs/vite-plugin writes for solid-js's `lazy`, resolved by
// that plugin to a project-relative module path.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import babel from "@babel/core";
import { devServer } from "./server.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import blocks, { LAZY_PLACEHOLDER_PREFIX, babelPluginBlocks, transform } from "../src/index.js";

const app = fileURLToPath(new URL("./fixtures/app/", import.meta.url));
const renderingTwin = fileURLToPath(
  new URL("../../../examples/rendering-blocks/", import.meta.url)
);
const IMPORT = 'import { lazy } from "solid-blocks";\n';
const run = (code, options) =>
  transform(code, { filename: "/src/a.tsx", ...options })?.code ?? null;
const placeholder = spec => JSON.stringify(LAZY_PLACEHOLDER_PREFIX + spec);

describe("which calls are annotated (the compiler's lazy pass, for the blocks module)", () => {
  it("lazy(fn): the options slot is filled with void 0", () => {
    expect(run(IMPORT + 'const A = lazy(() => import("./A"));')).toBe(
      IMPORT + `const A = lazy(() => import("./A"), void 0, ${placeholder("./A")});`
    );
  });

  it("lazy(fn, options): the placeholder is the third argument", () => {
    expect(run(IMPORT + 'const A = lazy(() => import("./A"), { export: "B" });')).toBe(
      IMPORT + `const A = lazy(() => import("./A"), { export: "B" }, ${placeholder("./A")});`
    );
  });

  it("a block body or a function expression returning the import", () => {
    expect(run(IMPORT + 'lazy(() => { return import("./A"); });')).toContain(placeholder("./A"));
    expect(run(IMPORT + 'lazy(function () { return import("./A"); });')).toContain(
      placeholder("./A")
    );
  });

  it("leaves everything else alone", () => {
    for (const code of [
      // already annotated
      IMPORT + 'lazy(() => import("./A"), undefined, "x");',
      // solid-js's lazy: @solidjs/vite-plugin's own pass
      'import { lazy } from "solid-js";\nlazy(() => import("./A"));',
      // an aliased import, as in the compiler's pass
      'import { lazy as l } from "solid-blocks";\nl(() => import("./A"));',
      // a shadowed `lazy`
      IMPORT + 'function f(lazy) { return lazy(() => import("./A")); }',
      // not a literal specifier, not a bare import, a spread options slot
      IMPORT + "lazy(() => import(name));",
      IMPORT + 'lazy(() => load(import("./A")));',
      IMPORT + 'lazy(() => import("./A"), ...rest);'
    ])
      expect(run(code), code).toBeNull();
  });

  it("a module with holes and lazy calls gets both", () => {
    const out = run(
      IMPORT +
        'const A = lazy(() => import("./A"));\nconst v = function* () { return <p>{yield* A()}</p>; };'
    );
    expect(out).toContain(placeholder("./A"));
    expect(out).toContain("{_$perform(A())}");
  });

  it("is off with lazy: false, and follows blocksModule", () => {
    expect(run(IMPORT + 'lazy(() => import("./A"));', { lazy: false })).toBeNull();
    expect(
      run('import { lazy } from "my-blocks";\nlazy(() => import("./A"));', {
        blocksModule: "my-blocks"
      })
    ).toContain(placeholder("./A"));
  });

  it("the Babel plugin writes the same annotation", () => {
    const out = babel.transformSync(IMPORT + 'const A = lazy(() => import("./A"));', {
      babelrc: false,
      configFile: false,
      filename: "/src/a.tsx",
      plugins: [babelPluginBlocks]
    });
    expect(out.metadata.blocks).toEqual({ holes: false, lazy: true });
    expect(out.code).toContain(`lazy(() => import("./A"), void 0, ${placeholder("./A")})`);
  });
});

describe("blocks() + solid(): the placeholder resolves to a module URL", () => {
  let server;
  beforeAll(async () => {
    server = await devServer(app);
  });
  afterAll(() => server?.close());

  it("in the client build", async () => {
    const { code } = await server.transformRequest("/Lazy.tsx");
    expect(code).toContain('{ export: "Card" }, "Card.tsx")');
    expect(code).toContain('void 0, "Page.tsx")');
  });

  it("on the server: the lazy component carries its moduleUrl", async () => {
    const mod = await server.ssrLoadModule("/Lazy.tsx");
    expect(mod.LazyCard.moduleUrl).toBe("Card.tsx");
    expect(mod.LazyPage.moduleUrl).toBe("Page.tsx");
  });

  it("a module with no function* and no blocks lazy is not looked at", async () => {
    const plugin = blocks();
    expect(plugin.transform.call({}, 'import { lazy } from "solid-js";', "/a.tsx")).toBeNull();
  });
});

// The twin that motivated it: rendering-blocks' pages (D-047 finding).
describe.skipIf(!existsSync(renderingTwin))("rendering-blocks' pages get a moduleUrl", () => {
  let server;
  beforeAll(async () => {
    server = await devServer(renderingTwin);
  });
  afterAll(() => server?.close());

  it("App.tsx and Profile/index.tsx", async () => {
    const app = (await server.transformRequest("/shared/src/components/App.tsx")).code;
    for (const page of ["Home", "Settings", "Stream", "ErrorStream", "Reveal", "Skeleton"])
      expect(app).toContain(`void 0, "shared/src/components/${page}.tsx")`);
    const profile = (await server.transformRequest("/shared/src/components/Profile/index.tsx"))
      .code;
    expect(profile).toContain('void 0, "shared/src/components/Profile/Profile.tsx")');
  });
});
