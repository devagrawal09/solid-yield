// @ts-check
import { it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createChecker } from "./index.mjs";
import { join, plain } from "./graph.mjs";
const packageDir = fileURLToPath(new URL("../../", import.meta.url));
const imports =
  "import {render} from '@solidjs/web'; import {createSignal,createMemo,Loading,Errored,createContext,useContext} from 'solid-js';";
function project(sources, test) {
  const rootDir = mkdtempSync(resolve(packageDir, ".oxc-scale-"));
  const texts = new Map(
    Object.entries(sources).map(([file, text]) => [resolve(rootDir, file), text])
  );
  for (const [file, text] of texts) writeFileSync(file, text);
  const options = { rootDir, files: [...texts.keys()], readFile: file => texts.get(file) };
  const checker = createChecker(options);
  const update = (file, text) => {
    texts.set(resolve(rootDir, file), text);
    return checker.update(resolve(rootDir, file), text);
  };
  const fresh = () => {
    const next = createChecker(options);
    try {
      return next.check();
    } finally {
      next.dispose();
    }
  };
  try {
    test({ checker, update, fresh, rootDir });
  } finally {
    checker.dispose();
    rmSync(rootDir, { recursive: true, force: true });
  }
}
const codes = result => result.diagnostics.map(d => d.code).sort();
const findings = result =>
  result.diagnostics
    .map(d => ({ code: d.code, loc: d.loc, data: d.data }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
it("deduplicates scalar alternatives without merging different scalar kinds", () => {
  expect(join(plain(1), plain(1)).tag).toBe("plain");
  expect(
    join(
      plain(-0),
      plain(0),
      plain("-0"),
      plain(Infinity),
      plain(-Infinity),
      plain(NaN),
      plain(1n),
      plain("1")
    ).arms
  ).toHaveLength(8);
});
it("replays cached function failures into each memo capture", () => {
  project(
    {
      "main.tsx":
        imports +
        "function fail(){throw new RangeError()} function App(){const a=createMemo(()=>fail());const b=createMemo(()=>fail());return <p>{a()}{b()}</p>} render(App,document.body);"
    },
    ({ checker }) => {
      const result = checker.check();
      expect(result.scale.summaryHits).toBeGreaterThan(0);
      expect(
        result.diagnostics.filter(d => d.code === "ERROR_OUTSIDE_ERRORED_BOUNDARY")
      ).toHaveLength(2);
    }
  );
});
it("invalidates memoized calls after captured cell writes", () => {
  project(
    {
      "main.tsx":
        imports +
        "function App(){let broken=false;const a=createMemo(()=>{if(broken)throw new Error();return 1});a();broken=true;return <p>{a()}</p>} render(App,document.body);"
    },
    ({ checker }) => {
      expect(codes(checker.check())).toContain("ERROR_OUTSIDE_ERRORED_BOUNDARY");
    }
  );
});
it("does not share a promise's handled flag between cached calls", () => {
  project(
    {
      "main.tsx":
        imports +
        "function fail(){return Promise.reject(new Error())} function App(){return <button onClick={()=>{fail().catch(()=>{});fail()}}/>} render(App,document.body);"
    },
    ({ checker }) => {
      expect(codes(checker.check())).toContain("UNHANDLED_HANDLER_FAILURE");
    }
  );
});
it("moves cached diagnostics and related locations after a comment edit", () => {
  const text =
    imports +
    "function App(){const read=createMemo(()=>Promise.resolve(1));return <p>{read()}</p>} render(App,document.body);";
  project({ "main.tsx": text }, ({ checker, update, fresh }) => {
    const before = checker.check();
    const line = before.diagnostics.find(d => d.code === "ASYNC_OUTSIDE_LOADING_BOUNDARY").loc.line;
    const result = update("main.tsx", "// comment" + String.fromCharCode(10) + text);
    expect(result.scale.checkedJobs).toBe(0);
    expect(result.summaryChangedFiles).toEqual([]);
    expect(result.diagnostics.find(d => d.code === "ASYNC_OUTSIDE_LOADING_BOUNDARY").loc.line).toBe(
      line + 1
    );
    expect(findings(result)).toEqual(findings(fresh()));
  });
});
it("rechecks importers but keeps an unrelated module cached", () => {
  const main =
    imports +
    'import {work} from "./work";function App(){return <button onClick={()=>work()}/>}render(App,document.body);';
  project(
    {
      "main.tsx": main,
      "work.ts": "export function work(){return Promise.resolve(1)}",
      "other.tsx": "export function Other(){return <p/>}"
    },
    ({ checker, update, fresh, rootDir }) => {
      expect(codes(checker.check())).not.toContain("UNHANDLED_HANDLER_FAILURE");
      const result = update(
        "work.ts",
        "export function work(){return Promise.reject(new Error())}"
      );
      expect(codes(result)).toContain("UNHANDLED_HANDLER_FAILURE");
      expect(result.invalidatedFiles).not.toContain(resolve(rootDir, "other.tsx"));
      expect(result.scale.reusedJobs).toBeGreaterThan(0);
      expect(findings(result)).toEqual(findings(fresh()));
    }
  );
});
it("sends changed prop facts from caller to child and obligations back", () => {
  const child = "export function Child(props:{value:string}){return <p>{props.value}</p>}";
  const main = value =>
    imports +
    'import {Child} from "./child";function App(){const read=createMemo(()=>Promise.resolve("ready"));return <Child value={' +
    value +
    "}/>}render(App,document.body);";
  project({ "main.tsx": main('"held"'), "child.tsx": child }, ({ checker, update, fresh }) => {
    expect(codes(checker.check())).not.toContain("ASYNC_OUTSIDE_LOADING_BOUNDARY");
    const result = update("main.tsx", main("read()"));
    const pending = result.diagnostics.find(d => d.code === "ASYNC_OUTSIDE_LOADING_BOUNDARY");
    expect(pending.loc.file.endsWith("child.tsx")).toBe(true);
    expect(pending.related.some(r => r.loc.file.endsWith("main.tsx"))).toBe(true);
    expect(findings(result)).toEqual(findings(fresh()));
    const changed = update(
      "child.tsx",
      "export function Child(props:{value:string}){const x=props.value;return <p>{x}</p>}"
    );
    expect(codes(changed)).toContain("PENDING_ASYNC_UNTRACKED_READ");
    expect(findings(changed)).toEqual(findings(fresh()));
  });
});
it("removes a deleted root's diagnostics rather than retaining stale output", () => {
  const component =
    imports +
    "export function App(){const read=createMemo(()=>Promise.resolve(1));return <p>{read()}</p>}";
  project(
    { "main.tsx": component + "render(App,document.body);" },
    ({ checker, update, fresh }) => {
      expect(codes(checker.check())).toContain("ASYNC_OUTSIDE_LOADING_BOUNDARY");
      const result = update("main.tsx", component);
      expect(codes(result)).not.toContain("ASYNC_OUTSIDE_LOADING_BOUNDARY");
      expect(codes(result)).toContain("COMPONENT_OBLIGATIONS_EXPORTED");
      expect(findings(result)).toEqual(findings(fresh()));
    }
  );
});
it("keeps a shared diagnostic when only one of its roots is removed", () => {
  const app =
    'import {createMemo} from "solid-js";export function App(){const read=createMemo(()=>Promise.resolve(1));return <p>{read()}</p>}';
  const root =
    'import {render} from "@solidjs/web";import {App} from "./app";render(App,document.body);';
  project({ "app.tsx": app, "one.tsx": root, "two.tsx": root }, ({ checker, update, fresh }) => {
    checker.check();
    const result = update("one.tsx", "export const removed=1;");
    expect(codes(result)).toContain("ASYNC_OUTSIDE_LOADING_BOUNDARY");
    expect(codes(result)).toEqual(codes(fresh()));
  });
});
it("invalidates a cached helper when an object becomes a context service", () => {
  project(
    {
      "main.tsx":
        imports +
        "declare function opaque(value:object):void;function pass(value:object){opaque(value)}function App(){const value={};pass(value);const C=createContext(value);useContext(C);pass(value);return <p/>}render(App,document.body);"
    },
    ({ checker }) => {
      expect(
        checker
          .check()
          .diagnostics.some(
            d =>
              d.code === "UNANALYZED_BOUNDARY" &&
              d.data.construct === "context passed to unknown code"
          )
      ).toBe(true);
    }
  );
});
it("invalidates other render jobs affected by a shared module write", () => {
  const root = 'import {render} from "@solidjs/web";import {shared} from "./shared";';
  const one = body =>
    root + "function One(){shared.run=()=>{" + body + "};return <p/>}render(One,document.body);";
  const two =
    root + "function Two(){return <button onClick={()=>shared.run()}/>}render(Two,document.body);";
  project(
    {
      "shared.ts": "export const shared={run:()=>{}};",
      "one.tsx": one("throw new Error()"),
      "two.tsx": two
    },
    ({ checker, update, fresh, rootDir }) => {
      expect(codes(checker.check())).toContain("UNHANDLED_HANDLER_FAILURE");
      const result = update("one.tsx", one(""));
      expect(result.invalidatedFiles).toContain(resolve(rootDir, "two.tsx"));
      expect(codes(result)).not.toContain("UNHANDLED_HANDLER_FAILURE");
      expect(findings(result)).toEqual(findings(fresh()));
    }
  );
});
it("widens an expanding call tree instead of silently dropping its failures", () => {
  const helpers = [
    "function f0(){return {value:0}}",
    ...Array.from(
      { length: 18 },
      (_, i) => "function f" + (i + 1) + "(){return {a:f" + i + "(),b:f" + i + "()}}"
    )
  ].join(";");
  project(
    {
      "main.tsx":
        imports +
        helpers +
        ";function App(){return <button onClick={()=>f18()}/>}render(App,document.body);"
    },
    ({ checker }) => {
      const result = checker.check();
      expect(
        result.diagnostics.some(
          d => d.code === "UNANALYZED_BOUNDARY" && d.data.construct.includes("budget")
        )
      ).toBe(true);
      expect(codes(result)).toContain("PENDING_ASYNC_IN_HANDLER");
      expect(codes(result)).toContain("UNHANDLED_HANDLER_FAILURE");
    }
  );
});
