import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createChecker } from "../prototypes/oxc/index.mjs";
const base = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function project(files, run) {
  const dir = mkdtempSync(resolve(base, ".oxc-test-"));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(resolve(dir, name)), { recursive: true });
    writeFileSync(resolve(dir, name), text);
  }
  const paths = Object.keys(files)
    .filter(p => /[.](ts|tsx)$/.test(p))
    .map(p => resolve(dir, p));
  const checker = createChecker({ rootDir: dir, files: paths });
  try {
    return run(checker, dir);
  } finally {
    checker.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
}
const rootImports =
  "import {render} from '@solidjs/web'; import {createSignal,createMemo,createContext,useContext,Errored,Loading} from 'solid-js';";
it("follows renamed and star reexports to Solid, but not local names", () => {
  project(
    {
      "bridge.ts": "export {createMemo as deferred} from 'solid-js'; export * from 'solid-js';",
      "main.tsx":
        rootImports +
        "import {deferred,createSignal as signal} from './bridge'; function App(){const [n]=signal(1); const m=deferred(async()=>n()); return <p>{m()}</p>} render(App,document.body);"
    },
    c => {
      expect(c.check().diagnostics.map(d => d.code)).toEqual(["ASYNC_OUTSIDE_LOADING_BOUNDARY"]);
    }
  );
  project(
    {
      "main.tsx":
        "import {render} from '@solidjs/web'; function createSignal(){return [()=>1]} function App(){const [n]=createSignal();const x=n();return <p>{x}</p>} render(App,document.body);"
    },
    c => expect(c.check().diagnostics).toEqual([])
  );
});
it("keeps service instances separate and honors nearest provider", () => {
  project(
    {
      "main.tsx":
        rootImports +
        "const C=createContext(); function make(p){const v=createMemo(p);return {v}} function Child(){const s=useContext(C);return <p>{s.v()}</p>} function App(){const outer=make(async()=>1);const inner=make(()=>2);return <C value={outer}><C value={inner}><Child/></C></C>} render(App,document.body);"
    },
    c => expect(c.check().diagnostics).toEqual([])
  );
});
it("calls closures against the state at each call, not the last assignment", () => {
  project(
    {
      "main.tsx":
        rootImports +
        "function App(){let f=()=>1;const call=()=>f();const early=call();f=()=>{throw new Error()};return <p>{early}</p>} render(App,document.body);"
    },
    c => expect(c.check().diagnostics).toEqual([])
  );
});
it("uses annotations from declaration packages without treating plain functions as safe", () => {
  project(
    {
      "node_modules/service/package.json": JSON.stringify({
        name: "service",
        exports: { ".": { types: "./index.d.ts", default: "./index.js" } }
      }),
      "node_modules/service/index.d.ts":
        "export interface Api { save(): Promise<void>; ping(): void } export declare const api: Api;",
      "node_modules/service/index.js": "export const api = {};",
      "main.tsx":
        rootImports +
        "import {api} from 'service';function App(){return <><button onClick={async()=>{try{await api.save()}catch{}}}/><button onClick={()=>api.ping()}/></>}render(App,document.body);"
    },
    c => {
      const result = c.check();
      expect(result.diagnostics.map(d => d.code)).toEqual(["UNHANDLED_HANDLER_FAILURE"]);
      expect(result.inferenceNeededCount).toBeGreaterThan(0);
    }
  );
});
it("does not let sync try/catch catch a dropped rejection", () => {
  project(
    {
      "main.tsx":
        rootImports +
        "function App(){return <button onClick={()=>{try{Promise.reject(new Error())}catch{}}}/>}render(App,document.body);"
    },
    c => expect(c.check().diagnostics.map(d => d.code)).toEqual(["UNHANDLED_HANDLER_FAILURE"])
  );
});
it("lets a memo catch its own synchronous failures", () => {
  project(
    {
      "main.tsx":
        rootImports +
        "function App(){const m=createMemo(()=>{try{throw new Error()}catch{return 1}});return <p>{m()}</p>}render(App,document.body);"
    },
    c => expect(c.check().diagnostics).toEqual([])
  );
});
it("replaces old diagnostics after an edit and rejects work after dispose", () => {
  const start =
    rootImports +
    "function App(){const m=createMemo(async()=>1);return <p>{m()}</p>}render(App,document.body);";
  project({ "main.tsx": start }, (c, dir) => {
    expect(c.check().diagnostics).toHaveLength(1);
    expect(
      c.update(
        resolve(dir, "main.tsx"),
        start.replace("<p>{m()}</p>", "<Loading><p>{m()}</p></Loading>")
      ).diagnostics
    ).toEqual([]);
    c.dispose();
    expect(() => c.check()).toThrow("disposed");
  });
});

it("refreshes a memo summary when a captured binding changes before its read", () => {
  project(
    {
      "main.tsx":
        rootImports +
        "function App(){let f=()=>1;const m=createMemo(()=>f());f=()=>{throw new Error()};return <p>{m()}</p>}render(App,document.body);"
    },
    c => expect(c.check().diagnostics.map(d => d.code)).toEqual(["ERROR_OUTSIDE_ERRORED_BOUNDARY"])
  );
});
it("does not grant a platform contract to a project receiver with the same name", () => {
  project(
    {
      "main.tsx":
        rootImports +
        "function App(){const Math={max(){throw new Error()}};return <p>{Math.max()}</p>}render(App,document.body);"
    },
    c => expect(c.check().diagnostics.map(d => d.code)).toEqual(["ERROR_OUTSIDE_ERRORED_BOUNDARY"])
  );
});
