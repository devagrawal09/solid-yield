import { afterAll, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  vi.stubGlobal("__SERVER__", false);
  vi.stubGlobal("__DEV__", true);
});
afterAll(() => vi.unstubAllGlobals());
// Node normally resolves the server implementation, whose actions do not
// suspend. These tests exercise client events and the real client driver.
vi.mock("solid-js", () => import("../node_modules/solid-js/dist/solid.js"));
import { resolve } from "node:path";
import ts from "typescript";
import { createRoot, flush } from "solid-js";
import * as core from "../../yield/src/index.js";
import * as internal from "../../yield/src/internal.js";
import { lowerNativeProject } from "../src/native.js";

const id = resolve(import.meta.dirname, "fixtures/consumer-runtime.tsx");
const source = `import { createSignal } from "solid-js";
export function Form(props: {save: (title: string) => Promise<boolean>; log: string[]}) {
  const [title, setTitle] = createSignal("draft");
  const [busy, setBusy] = createSignal(false);
  const mutate = async (run: () => Promise<boolean>) => {
    setBusy(true); props.log.push("busy");
    try { const ok = await run(); props.log.push("saved"); return ok; }
    catch { props.log.push("caught"); return false; }
    finally { props.log.push("idle"); setBusy(false); }
  };
  function makeDesk() { return { add: (value: string) => mutate(() => props.save(value)) }; }
  const desk = makeDesk();
  const submit = async () => {
    props.log.push("start");
    try {
      const ok = await desk.add(title());
      props.log.push("after");
      if (ok) setTitle("");
    } finally { props.log.push("done"); }
  };
  return <form onSubmit={submit}>
    <input onInput={(e: InputEvent) => setTitle((e.target as HTMLInputElement).value)}/>
    <button onClick={() => ({ title: title(), busy: busy() })}/>
  </form>;
}`;

// Only the element factory records the rendered props instead of creating DOM.
// The compiled JSX, event binding, transaction and async driver are real.
const load = code => {
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
  expect(
    ts
      .getPreEmitDiagnostics(ts.createProgram([id], options, host))
      .map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
  ).toEqual([]);
  const js = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      jsxFactory: "__jsx"
    }
  }).outputText;
  const exports = {};
  new Function("exports", "require", "__jsx", js)(
    exports,
    name => {
      if (name === "solid-yield") return core;
      if (name === "solid-yield/internal") return internal;
      throw new Error(`Unexpected runtime import: ${name}`);
    },
    (tag, props, ...children) => ({ tag, props, children })
  );
  return exports;
};

describe("lowered native consumer runtime", { timeout: 30_000 }, () => {
  it.each(
    ["kept", "direct", "expression"].flatMap(shape => [
      ["method", false, shape],
      ["method", true, shape],
      ["callback", false, shape],
      ["callback", true, shape]
    ])
  )(
    "assimilates a returned promise at the caller await, not in the helper catch (%s, reject=%s, %s)",
    async (mode, reject, shape) => {
      const begin = source.indexOf("  const mutate =");
      const end = source.indexOf("  function makeDesk");
      let program =
        source.slice(0, begin) +
        `
        const mutate = async (run: () => Promise<boolean>) => {
          setBusy(true); props.log.push("busy");
          try { const pending = run(); props.log.push("returning"); return pending; }
          catch { props.log.push("helper-caught"); return false; }
          finally { props.log.push("helper-done"); setBusy(false); }
        };
      ` +
        source.slice(end);
      if (shape === "direct")
        program = program
          .replace("const pending = run(); ", "")
          .replace("return pending;", "return run();");
      if (shape === "expression")
        program =
          source.slice(0, begin) +
          `
        const mutate = async (run: () => Promise<boolean>) =>
          (setBusy(true), props.log.push("busy"), props.log.push("returning"),
           setBusy(false), props.log.push("helper-done"), run());
      ` +
          source.slice(end);
      program = program.replace(
        `} finally { props.log.push("done"); }`,
        `} catch { props.log.push("caller-caught"); } finally { props.log.push("done"); }`
      );
      if (mode === "callback")
        program = program.replace(
          "await desk.add(title())",
          "await mutate(() => props.save(title()))"
        );
      const { Form } = load(lowerNativeProject(new Map([[id, program]])).files.get(id));
      const log = [];
      let resolveSave, rejectSave;
      const pending = new Promise((resolve, reject) => {
        resolveSave = resolve;
        rejectSave = reject;
      });
      const { form, dispose } = createRoot(dispose => ({
        form: Form({ save: () => pending, log }),
        dispose
      }));
      try {
        const result = form.props.onSubmit();
        expect(log).toEqual(["start", "busy", "returning", "helper-done"]);
        if (reject) rejectSave(new RangeError("save failed"));
        else resolveSave(true);
        await result;
        expect(log).toEqual([
          "start",
          "busy",
          "returning",
          "helper-done",
          reject ? "caller-caught" : "after",
          "done"
        ]);
      } finally {
        dispose();
      }
    }
  );
  it("keeps draft state separate for two mounted forms", async () => {
    const { Form } = load(lowerNativeProject(new Map([[id, source]])).files.get(id));
    const saved = [];
    const { forms, dispose } = createRoot(dispose => ({
      forms: [0, 1].map(() =>
        Form({
          save: title => {
            saved.push(title);
            return Promise.resolve(true);
          },
          log: []
        })
      ),
      dispose
    }));
    try {
      await forms[0].children[0].props.onInput({ target: { value: "first form" } });
      expect(await forms[1].children[1].props.onClick()).toEqual({ title: "draft", busy: false });
      await forms[0].props.onSubmit();
      expect(await forms[0].children[1].props.onClick()).toEqual({ title: "", busy: false });
      expect(await forms[1].children[1].props.onClick()).toEqual({ title: "draft", busy: false });
      await forms[1].props.onSubmit();
      expect(saved).toEqual(["first form", "draft"]);
    } finally {
      dispose();
    }
  });
  it.each(["method", "callback"])(
    "catches synchronous failures from an owned %s and finalizes",
    async mode => {
      const program =
        mode === "method"
          ? source
          : source.replace("await desk.add(title())", "await mutate(() => props.save(title()))");
      const { Form } = load(lowerNativeProject(new Map([[id, program]])).files.get(id));
      const log = [];
      const { form, dispose } = createRoot(dispose => ({
        form: Form({
          save: () => {
            throw new RangeError("save failed");
          },
          log
        }),
        dispose
      }));
      try {
        await form.props.onSubmit();
        expect(log).toEqual(["start", "busy", "caught", "idle", "after", "done"]);
        expect(await form.children[1].props.onClick()).toEqual({ title: "draft", busy: false });
      } finally {
        dispose();
      }
    }
  );
  it("propagates an uncaught failure from a known method and still runs finally", async () => {
    const program = source.replace(`catch { props.log.push("caught"); return false; }`, "");
    const result = lowerNativeProject(new Map([[id, program]]));
    expect(result.inference.diagnostics.some(d => d.code === "EVENT_REJECTS")).toBe(true);
    const { Form } = load(result.files.get(id));
    const log = [],
      failure = new RangeError("save failed");
    const { form, dispose } = createRoot(dispose => ({
      form: Form({ save: () => Promise.reject(failure), log }),
      dispose
    }));
    try {
      let received;
      try {
        await form.props.onSubmit();
      } catch (error) {
        received = internal.nativeFailureValue(error);
      }
      expect(received).toBe(failure);
      expect(log).toEqual(["start", "busy", "idle", "done"]);
    } finally {
      dispose();
    }
  });
  it.each([
    ["method", false],
    ["method", true],
    ["callback", false],
    ["callback", true]
  ])("awaits an owned %s before writes and finally (reject=%s)", async (mode, reject) => {
    const program =
      mode === "method"
        ? source
        : source.replace("await desk.add(title())", "await mutate(() => props.save(title()))");
    const code = lowerNativeProject(new Map([[id, program]])).files.get(id);
    const { Form } = load(code);
    const log = [],
      saved = [];
    let resolveSave, rejectSave;
    const pending = new Promise((resolve, reject) => {
      resolveSave = resolve;
      rejectSave = reject;
    });
    const { form, dispose } = createRoot(dispose => ({
      form: Form({
        save: title => {
          saved.push(title);
          return pending;
        },
        log
      }),
      dispose
    }));
    const [input, probe] = form.children;
    try {
      const result = form.props.onSubmit();
      expect(saved).toEqual(["draft"]);
      expect(log).toEqual(["start", "busy"]);
      await input.props.onInput({ target: { value: "changed while waiting" } });
      flush();
      if (reject) rejectSave(new RangeError("save failed"));
      else resolveSave(true);
      await result;
      flush();
      expect(log).toEqual(["start", "busy", reject ? "caught" : "saved", "idle", "after", "done"]);
      expect(saved).toEqual(["draft"]);
      expect(await probe.props.onClick()).toEqual({
        title: reject ? "changed while waiting" : "",
        busy: false
      });
    } finally {
      dispose();
    }
  });
});
