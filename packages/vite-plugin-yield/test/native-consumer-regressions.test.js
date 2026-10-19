import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import ts from "typescript";
import { lowerNativeProject } from "../src/native.js";
import { reconstructProject } from "../src/routines.js";

const id = resolve(import.meta.dirname, "fixtures/consumer.tsx");
const lower = source => lowerNativeProject(new Map([[id, source]])).files.get(id);
const checked = code => {
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "solid-yield",
    types: []
  };
  const host = ts.createCompilerHost(options),
    read = host.readFile;
  host.readFile = file => (file === id ? code : read(file));
  return ts
    .getPreEmitDiagnostics(ts.createProgram([id], options, host))
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
};

describe("native consumer regressions", { timeout: 30_000 }, () => {
  it("keeps an async memo's returned promise helper owned and handled", () => {
    const out = lower(`import { createMemo, createSignal, Errored, Loading } from "solid-js";
      import { render } from "@solidjs/web";
      function loadItem(id: string): Promise<{ title: string }> {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (id !== "ok") { reject(new Error("missing")); return; }
            resolve({ title: "loaded" });
          }, 1);
        });
      }
      function App() { const [id] = createSignal("ok");
        const item = createMemo<{ title: string }>(async () => loadItem(id()));
        return <Errored fallback="failed"><Loading fallback="loading"><p>{item().title}</p></Loading></Errored>;
      }
      render(App, document.body);`);
    expect(checked(out)).toEqual([]);
  });
  it.each([
    "direct",
    "alias",
    "computed",
    "assign",
    "define-property",
    "define-properties",
    "reflect-set",
    "reflect-define",
    "unchanged"
  ])("does not trust an overridden array method (%s)", mode => {
    const mutation = {
      direct: "items.map = storing;",
      alias: "const alias = items; alias.map = storing;",
      computed: 'const method = "map" as const; items[method] = storing;',
      assign: "Object.assign(items, { map: storing });",
      "define-property": 'Object.defineProperty(items, "map", { value: storing });',
      "define-properties": "Object.defineProperties(items, { map: { value: storing } });",
      "reflect-set": 'Reflect.set(items, "map", storing);',
      "reflect-define": 'Reflect.defineProperty(items, "map", { value: storing });',
      unchanged: ""
    }[mode];
    const source = `import { createSignal } from "solid-js";
      let kept: (() => unknown) | undefined;
      export function App() {
        const [n] = createSignal(0); const items = [1];
        const storing = <U,>(callback: (value: number, index: number, array: number[]) => U): U[] => {
          kept = () => callback(1, 0, items); return [];
        };
        ${mutation}
        return <button onClick={() => items.map(() => n())}/>;
      }`;
    if (mode === "unchanged") expect(checked(lower(source))).toEqual([]);
    else expect(() => lower(source)).toThrow(/SUGAR_(CALLBACK|ESCAPE)/);
  });

  it.each(["map", "filter", "find", "some", "every", "forEach"])(
    "checks a later setup read before refusing its %s callback",
    method => {
      const out = lower(`import {createMemo,Loading} from "solid-js";
        export function App() {
          const value = createMemo(async () => 1);
          const items = createMemo(async () => [1,2,3]);
          const selected = createMemo(() => snapshot.${method}(item => item * value()));
          const snapshot = items();
          return <Loading fallback="..."><p>{String(selected())}</p></Loading>;
        }`);
      expect(checked(out).join(" ")).toMatch(/Read<true|READ_IN_SETUP/);
    }
  );

  it("retains independent module-state errors beside an ownership refusal", () => {
    const source = `import {createSignal} from "solid-js";
      const [shared] = createSignal(0);
      declare function keep(callback: () => number): void;
      export function App() { const [count] = createSignal(0);
        return <button onClick={() => keep(() => shared() + count())}/>; }`;
    try {
      lower(source);
      throw new Error("Expected an ownership refusal");
    } catch (error) {
      expect(error.code).toBe("SUGAR_CALLBACK");
      expect(error.diagnostics.map(d => d.code)).toEqual(["SUGAR_CALLBACK", "MODULE_STATE"]);
      expect(error.diagnostics[1].line).toBe(2);
    }
  });

  it.each(["map", "filter", "find", "some", "every", "forEach"])(
    "keeps a known array callback's setup read visible (%s)",
    method => {
      const out = lower(`import { createSignal } from "solid-js";
      export function App() { const [n] = createSignal(1);
        [1].${method}(() => n()); return <p/>; }`);
      expect(out).toContain('__nativeLexicalCallback("setup"');
      // The raw TS checker prints the rejected operation; the service names it READ_IN_SETUP.
      expect(checked(out).join("\n")).toContain("Read<");
    }
  );
  it("keeps the readStore selector for a pure store-array callback", () => {
    const out = lower(`import { createMemo, createStore } from "solid-js";
      export function Form() {
        const [store] = createStore({ list: [{ title: "draft" }] });
        const titles = createMemo(() => store.list.map(row => row.title).join());
        return <p>{titles()}</p>;
      }`);
    expect(out).toContain("__nativeReadStore");
    expect(checked(out)).toEqual([]);
  });
  it.each([
    "callbacks.push(run);",
    "callbacks.push(() => run());",
    "const old = run; run = () => false; callbacks.push(old);",
    "forward(run);"
  ])("refuses event-local callbacks whose consumer escapes them: %s", body => {
    expect(() =>
      lower(`import { createSignal } from "solid-js";
        declare function forward(run: () => boolean): void;
        const callbacks: (() => boolean)[] = [];
        function mutate(run: () => boolean) { ${body} return true; }
        export function Form() { const [busy] = createSignal(false);
          return <form onSubmit={() => { mutate(() => busy()); }}/>; }`)
    ).toThrow(/SUGAR_(CALLBACK|ESCAPE)/);
  });
  // D-124: plain Solid may keep or drop a promise; a plain callee's stays one.
  it.each([
    "run();",
    "void run();",
    "const pending = run();",
    "const pending = run(); const alias = pending;",
    "const pending = run(); void pending;"
  ])("keeps a dropped or held callback promise a promise, as written: %s", dropped => {
    const code = lower(`import { createSignal } from "solid-js";
      export function Form() { const [busy, setBusy] = createSignal(false);
        const mutate = async (run: () => Promise<boolean>) => {
          ${dropped} setBusy(false); return true;
        };
        return <form onSubmit={async () => { await mutate(() => Promise.resolve(true)); }}/>;
      }`);
    // Nothing awaits the dropped promise: no attempt of a `run()` whose value is waited for.
    expect(code).not.toMatch(/yield\* __nativeAttempt\(\(\) => run\(\)/);
    expect(code).not.toMatch(
      /yield\* __nativeAttempt\(\(\) => (?:pending|Promise\.reject|new Promise)/
    );
    expect(checked(code)).toEqual([]);
  });
  it.each([
    "const pending = Promise.reject(new Error());",
    "const pending = new Promise<boolean>((resolve, reject) => reject(new Error()));",
    "Promise.reject(new Error());"
  ])("keeps a held or dropped platform promise a promise, as written: %s", dropped => {
    const code = lower(`import { createSignal } from "solid-js";
      export function Form() { const [busy, setBusy] = createSignal(false);
        return <form onSubmit={async () => { ${dropped} setBusy(false); }}/>;
      }`);
    expect(code).not.toMatch(/__nativeAttempt\(\(\) => (?:pending|Promise\.reject|new Promise)/);
    expect(checked(code)).toEqual([]);
  });
  // An async reactive helper runs where it is called (`yield* save(1)`): its
  // promise cannot be a value the code goes on to use, nor dropped (D-127 §5,
  // Dev: report it): the statements after it would run after the helper,
  // where Solid runs them at its first await.
  it.each([
    [
      "a local awaited later",
      "const p = save(1); const q = save(2); return (await p) + (await q);"
    ],
    ["an argument", "track(save(1)); return 0;"],
    ["a receiver", "return save(1).then(n => n);"],
    ["a sync event's local", "const p = save(1); track(p);", false],
    ["dropped", "save(1); setBusy(true);"],
    ["voided", "void save(1); setBusy(true);"],
    ["dropped in a sync event", "save(1); setBusy(true);", false],
    ["dropped last in a sync event", "save(1);", false]
  ])(
    "refuses an async helper's promise not awaited or returned where it is made: %s",
    (_, body, async = true) => {
      expect(() =>
        lower(`import { createSignal } from "solid-js";
      declare function track(p: Promise<unknown>): void;
      export function Form() { const [busy, setBusy] = createSignal(false);
        const save = async (n: number) => { setBusy(true); await Promise.resolve(n); setBusy(false); return n; };
        return <form onSubmit={${async ? "async " : ""}() => { ${body} }}/>;
      }`)
      ).toThrow(/NATIVE_DETACHED_PROMISE/);
    }
  );
  it.each([
    ["awaited", "async () => { await save(1); setBusy(true); }"],
    ["returned", "async () => { return save(1); }"],
    ["returned by a sync event", "() => { return save(1); }"],
    ["a sync event's expression body", "() => save(1)"]
  ])("runs an async helper where it is called when its promise is %s", (_, handler) => {
    const code = lower(`import { createSignal } from "solid-js";
      export function Form() { const [busy, setBusy] = createSignal(false);
        const save = async (n: number) => { setBusy(true); await Promise.resolve(n); setBusy(false); return n; };
        return <form onSubmit={${handler}}/>;
      }`);
    expect(code).toMatch(/yield\* save\(1\)/);
    expect(checked(code)).toEqual([]);
  });
  // A member called on a local literal bag has the literal's implementation
  // only while nothing can change the bag: a write to a member or an escape
  // leaves its failures unknown.
  it.each([
    ["kept as made", "", /RangeError/, /unknown/],
    [
      "a member written",
      'api.save = () => { throw new TypeError("y"); };',
      /unknown/,
      /RangeError/
    ],
    ["escaped", "register(api);", /unknown/, /RangeError/]
  ])(
    "a local bag's member call fails as its literal says only while the bag is %s",
    (_, use, expected, absent) => {
      const source = `import { createSignal } from "solid-js";
      import { render } from "@solidjs/web";
      declare function register(x: unknown): void;
      export function App() { const [n, setN] = createSignal(1);
        const api = { save() { setN(2); throw new RangeError("x"); } };
        ${use}
        return <button onClick={() => api.save()}>{n()}</button>; }
      render(() => <App/>, document.body);`;
      const result = lowerNativeProject(new Map([[id, source]]));
      const rejects = result.inference.diagnostics.filter(d => d.code === "EVENT_REJECTS");
      expect(rejects.map(d => d.message).join("\n")).toMatch(expected);
      expect(rejects.map(d => d.message).join("\n")).not.toMatch(absent);
    }
  );
  it.each([false, true])(
    "only admits a typed local provider bag with no foreign use (foreign=%s)",
    foreign => {
      const source = `import { createContext, createSignal, useContext } from "solid-js";
      interface Counter { count: () => number; inc: () => void; }
      declare function consume(value: Counter): void;
      const Ctx = createContext<Counter>();
      function Child() { const c = useContext(Ctx)!;
        return <button onClick={() => c.inc()}>{c.count()}</button>; }
      export function App() { const [count, set] = createSignal(0);
        const bag: Counter = { count, inc: () => set(count() + 1) };
        ${foreign ? "consume(bag);" : ""}
        return <Ctx value={bag}><Child/></Ctx>; }`;
      if (foreign) expect(() => lower(source)).toThrow(/SUGAR_CALLBACK/);
      else expect(checked(lower(source))).toEqual([]);
    }
  );
  it.each([
    "interface Factory { read: () => Generator<never, number, unknown>; }",
    "type Factory = () => Generator<never, number, unknown>;"
  ])("does not treat a type declaration as a runtime handoff: %s", declaration => {
    expect(
      lower(`${declaration}
      export function Form() { return <p/>; }`)
    ).toContain("Factory");
  });
  it("does not allow a captured routine through nativeInvoke without a driver", () => {
    expect(() =>
      reconstructProject(
        new Map([
          [
            id,
            `import type { Source } from "solid-yield";
      import { nativeInvoke } from "solid-yield/internal";
      declare const n: Source<number>;
      function read() { return n(); }
      nativeInvoke(read, null, []);`
          ]
        ])
      )
    ).toThrow(/SUGAR_ESCAPE/);
  });
  it("does not infer an event phase for a handler also handed to unknown code", () => {
    expect(() =>
      lower(`import { createSignal } from "solid-js";
      declare function hold(callback: () => Promise<void>): void;
      async function save(value: string) {}
      export function Form() { const [title] = createSignal("draft");
        const mutate = async (run: () => Promise<void>) => { await run(); };
        const submit = async () => { await mutate(() => save(title())); };
        hold(submit); return <form onSubmit={submit}/>;
      }`)
    ).toThrow(/SUGAR_(CALLBACK|ESCAPE)/);
  });
  it("does not drive a routine handed to an unresolved consumer", () => {
    expect(() =>
      lower(`import { createSignal } from "solid-js";
      declare function consume(callback: () => number): void;
      export function Form() { const [title] = createSignal("draft");
        function read() { return title().length; }
        consume(read); return <p/>; }`)
    ).toThrow(/SUGAR_ESCAPE/);
  });
  it("does not classify a returned bag shared with unknown code as owned", () => {
    expect(() =>
      lower(`import { createSignal } from "solid-js";
      declare function consume(bag: { read: () => number }): void;
      function makeBag() { const [title] = createSignal("draft");
        const bag = { read: () => title().length }; consume(bag); return bag; }
      export function Form() { const bag = makeBag(); return <p>{bag.read()}</p>; }`)
    ).toThrow(/SUGAR_CALLBACK/);
  });
  it("does not trust an unrelated nativeInvoke name", () => {
    expect(() =>
      lower(`import { createSignal } from "solid-js";
      declare function nativeInvoke(callback: () => number, receiver: unknown, args: []): number;
      export function Form() { const [title] = createSignal("draft");
        function read() { return title().length; }
        return <button onClick={() => nativeInvoke(read, null, [])}/>; }`)
    ).toThrow(/SUGAR_ESCAPE/);
  });
  it("refuses local callbacks a helper stores instead of invoking", () => {
    const out = lower(`import { createSignal } from "solid-js";
      const callbacks: (() => number)[] = [];
      function hold(callback: () => number) { callbacks.push(callback); }
      export function Form() { const [title] = createSignal("draft");
        hold(() => title().length); return <p/>; }`);
    expect(checked(out).join("\n")).toContain(
      "is not assignable to parameter of type '() => number'"
    );
  });
  it("keeps real failure obligations on an uncaught owned async method", () => {
    const source = `import { createSignal } from "solid-js";
      export function Form() { const [title] = createSignal("draft");
        const desk = { add: async (value: string) => {
          if (value) throw new RangeError("not saved"); return true; } };
        return <form onSubmit={async () => { await desk.add(title()); }}/>;
      }`;
    const result = lowerNativeProject(new Map([[id, source]]));
    expect(result.inference.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "EVENT_REJECTS",
          message: expect.stringContaining("RangeError")
        })
      ])
    );
    expect(result.files.get(id)).toContain("global:RangeError");
  });
  it("reads local draft state inside a synchronously invoked owned callback", () => {
    const out = lower(`import { createSignal } from "solid-js";
      async function save(title: string) { return title.length > 0; }
      export function Form() {
        const [title] = createSignal("");
        const [busy, setBusy] = createSignal(false);
        const mutate = async (run: () => Promise<boolean>) => {
          setBusy(true);
          try { return await run(); } finally { setBusy(false); }
        };
        return <form onSubmit={async () => { await mutate(() => save(title())); }}>
          <button disabled={busy()}/>
        </form>;
      }`);
    expect(out).toContain("yield* title");
    expect(checked(out)).toEqual([]);
  });
  it("keeps a local catch around an awaited method effective", () => {
    const source = `import { createSignal } from "solid-js";
      export function Form() { const [title] = createSignal("draft");
        const [status, setStatus] = createSignal("");
        const desk = { add: async (value: string) => {
          if (value) throw new RangeError("not saved"); return true; } };
        return <form onSubmit={async () => {
          try { await desk.add(title()); } catch { setStatus("failed"); }
        }}>{status()}</form>;
      }`;
    const result = lowerNativeProject(new Map([[id, source]]));
    expect(result.inference.diagnostics.filter(d => d.code === "EVENT_REJECTS")).toEqual([]);
    expect(checked(result.files.get(id))).toEqual([]);
  });
  it("keeps form state local while awaiting an owned context method", () => {
    const out = lower(`import { createContext, createSignal, useContext } from "solid-js";
      function makeDesk() {
        const [saved, setSaved] = createSignal(0);
        const mutate = async (run: () => Promise<boolean>) => {
          try { const ok = await run(); setSaved(saved() + 1); return ok; }
          catch { return false; }
        };
        return { add: (title: string) => mutate(() => Promise.resolve(title.length > 0)) };
      }
      const Desk = createContext<ReturnType<typeof makeDesk>>();
      function Form() {
        const desk = useContext(Desk)!;
        const [title, setTitle] = createSignal("");
        const submit = async () => { if (await desk.add(title())) setTitle(""); };
        return <form onSubmit={submit}><input value={title()}/></form>;
      }
      export function App() { return <Desk value={makeDesk()}><Form/></Desk>; }`);
    expect(out).toContain("yield* title");
    expect(out).toContain("yield* setTitle");
    expect(checked(out)).toEqual([]);
  });
});
