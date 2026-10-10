import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";

// F-S51 (component factories, inline components, handler properties) and
// F-S52 (context facades): Rendering's router, as plain Solid writes it.
const dir = resolve(import.meta.dirname, "fixtures/native-factories");
const router = resolve(dir, "router.tsx"),
  app = resolve(dir, "App.tsx"),
  main = resolve(dir, "main.tsx");
// Real files: the stages before sugar resolve imports on disk.
const routerSource = readFileSync(router, "utf8");
const appSource = readFileSync(app, "utf8");
const mainSource = readFileSync(main, "utf8");
const lowerBoth = (routerCode = routerSource, appCode = appSource, mainCode = mainSource) => {
  const result = lowerNativeProject(
    new Map([
      [router, routerCode],
      [app, appCode],
      [main, mainCode]
    ])
  );
  return {
    result,
    router: result.files.get(router),
    app: result.files.get(app),
    main: result.files.get(main)
  };
};
const checked = files => {
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "solid-yield",
    types: [],
    lib: ["lib.esnext.d.ts", "lib.dom.d.ts"]
  };
  const host = ts.createCompilerHost(options),
    read = host.readFile;
  const exists = host.fileExists;
  host.readFile = path => files.get(path) ?? read(path);
  host.fileExists = path => files.has(path) || exists(path);
  return ts
    .getPreEmitDiagnostics(ts.createProgram([...files.keys()], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
};

describe(
  "native component factories (F-S51) and context facades (F-S52)",
  { timeout: 120_000 },
  () => {
    it("lowers a factory generic in its component's colors, and its returned component", () => {
      const { router: code } = lowerBoth();
      expect(code).toMatch(
        /function RouteHOC<_P0 extends boolean, _E0, _W0 extends boolean, _R0>\(Comp: __NativeComponent<\{\}, _P0, _E0, _W0, _R0>\)/
      );
      expect(code).toContain("return component(function* RouteHOCComponent(props: Props<{");
      expect(code).toContain("yield* Comp({})");
      expect(code).toContain("window.onpopstate = $event(function* ()");
    });

    it("types the context value as what is provided: a source and a routine", () => {
      const { router: code } = lowerBoth();
      expect(code).toMatch(
        /type RouterValue = \[\(import\("solid-yield"\)\.Source<string, never, false>\)/
      );
      expect(code).toMatch(/matches: \(\(match: string\) => Generator</);
    });

    it("lifts an inline component argument and delegates the context's routine", () => {
      const { result, router: r, app: a, main: m } = lowerBoth();
      expect(a).toContain("const AppComponent = component(function* AppComponent()");
      expect(a).toContain("const App = RouteHOC(AppComponent);");
      expect(a).toContain('yield* matches("index")');
      expect(result.diagnostics).toEqual([]);
      expect(
        checked(
          new Map([
            [router, r],
            [app, a]
          ])
        )
      ).toEqual([]);
    });

    it("a consumer rendered outside the factory requires the router", () => {
      const status = `export function Status() {
  const [location] = useRouter();
  return <p>{location()}</p>;
}`;
      const {
        router: r,
        app: a,
        main: m
      } = lowerBoth(
        routerSource,
        `${appSource}\n${status}`,
        mainSource
          .replace(
            "render(() => <App />, document.body);",
            "render(() => <App />, document.body);\nrender(() => <Status />, document.body);"
          )
          .replace('import App from "./App";', 'import App, { Status } from "./App";')
      );
      const errors = checked(
        new Map([
          [router, r],
          [app, a],
          [main, m]
        ])
      );
      // Only Status's root: the router's requirement, named.
      expect(errors.length).toBeGreaterThan(0);
      for (const error of errors) expect(error).toMatch(/RouterContext/);
      expect(errors.join("\n")).toMatch(/NO_PROVIDER/);
    });
  }
);
