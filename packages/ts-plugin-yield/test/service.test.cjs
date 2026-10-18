const test = require("node:test");
const assert = require("node:assert/strict");
const { makeService, root } = require("./helpers.cjs");
const { join } = require("node:path");
test("native selection updates positions after edits", () => {
  const name = "counter.tsx",
    file = join(root, name);
  const source =
    'import {createSignal} from "solid-js";\nexport function Counter(){\n const [n]=createSignal(0);\n const x=n();\n return <p>{x}</p>;\n}';
  const { service, input } = makeService({ [name]: source });
  try {
    let ds = service.diagnostics(file);
    assert.equal(ds.length, 1);
    assert.match(ds[0].messageText, /READ_IN_SETUP/);
    assert.equal(ds[0].file.getLineAndCharacterOfPosition(ds[0].start).line + 1, 4);
    input.set(file, "\n\n" + source);
    ds = service.diagnostics(file);
    assert.equal(ds[0].file.getLineAndCharacterOfPosition(ds[0].start).line + 1, 6);
    input.set(file, source.replace("const x=n();", "const x=1;"));
    assert.equal(service.diagnostics(file).length, 0);
  } finally {
    service.dispose();
  }
});
test("a legacy directive does not select an unconfigured file", () => {
  const file = join(root, "legacy.tsx");
  const source = `"use yield";
import {$signal} from "solid-yield";
export function Counter() { const [n] = $signal(0); return <p>{n()}</p>; }`;
  const { service } = makeService({ "legacy.tsx": source }, {});
  try {
    const state = service.refresh();
    assert.equal(state.selected.has(file), false);
    assert.equal(state.generated.get(file), source);
  } finally {
    service.dispose();
  }
});
test("native refusal recovery preserves selected diagnostics and unselected legacy files", () => {
  const refused = `import {createSignal} from "solid-js";
declare function opaque(callback: () => number): void;
export function Refused() { const [n] = createSignal(0); opaque(() => n()); return <p />; }`;
  const valid = `import {createSignal} from "solid-js";
export function Valid() { const [n] = createSignal(0); const value = n(); return <p>{value}</p>; }`;
  const legacy =
    '/** @jsxImportSource @solidjs/web */ "use yield"; const value: number = "wrong"; export function Legacy() { return <p>{value}</p>; }';
  const { service, input } = makeService(
    { "refused.tsx": refused, "valid.tsx": valid, "legacy.tsx": legacy },
    { mode: "native", include: ["refused.tsx", "valid.tsx"] }
  );
  const bad = join(root, "refused.tsx");
  const good = join(root, "valid.tsx");
  const plain = join(root, "legacy.tsx");
  try {
    assert.ok(service.diagnostics(bad).some(d => d.messageText.includes("[SUGAR_CALLBACK]")));
    const checkNeighbors = () => {
      const diagnostics = service.diagnostics(good);
      assert.equal(diagnostics.length, 1);
      assert.match(diagnostics[0].messageText, /READ_IN_SETUP/);
      assert.equal(diagnostics[0].start, valid.lastIndexOf("n()"));
      assert.deepEqual(
        service.diagnostics(plain).map(d => d.code),
        [2322]
      );
      const state = service.refresh();
      assert.equal(state.selected.has(plain), false);
      assert.equal(state.generated.get(plain), legacy);
    };
    checkNeighbors();
    input.set(bad, refused.replace("opaque(() => n());", ""));
    assert.equal(service.diagnostics(bad).length, 0);
    checkNeighbors();
  } finally {
    service.dispose();
  }
});
test("unselected source retains TypeScript errors and native selection is explicit", () => {
  const { service } = makeService({ "plain.ts": 'const n: number = "wrong";' }, {});
  try {
    assert.equal(service.diagnostics(join(root, "plain.ts"))[0].code, 2322);
  } finally {
    service.dispose();
  }
  assert.throws(() => makeService({}, { mode: "native" }), /NATIVE_INCLUDE/);
});
// an unselected file keeps TypeScript's message chain: reading it as a string
// threw, and the file lost every diagnostic (the CLI crashed)
test("TypeScript's errors with a message chain pass through, selected or not", () => {
  const chained =
    "function f(cb: (a: { k: number }) => void) { return cb; }\nf((a: { k: string }) => {});\n";
  const plain = makeService({ "plain.ts": chained }, {});
  const native = makeService({ "app.tsx": chained + "export function App() { return <p />; }" });
  try {
    for (const [service, file] of [
      [plain.service, "plain.ts"],
      [native.service, "app.tsx"]
    ]) {
      const [d, ...rest] = service.diagnostics(join(root, file));
      assert.deepEqual(rest, []);
      assert.equal(d.code, 2345);
      assert.match(
        plain.ts.flattenDiagnosticMessageText(d.messageText, "\n"),
        /Types of parameters 'a' and 'a' are incompatible/
      );
    }
  } finally {
    plain.service.dispose();
    native.service.dispose();
  }
});
test("cross-file colors come from the generated imported component", () => {
  const { service } = makeService({
    "child.tsx":
      'import {createMemo} from "solid-js";export function Child(){const n=createMemo(async()=>1);return <p>{n()}</p>}',
    "parent.tsx": 'import {Child} from "./child";export function Parent(){return <Child/>}'
  });
  try {
    const file = join(root, "parent.tsx");
    const qi = service.quickInfo(
      file,
      'import {Child} from "./child";export function Parent(){return <Child/>}'.lastIndexOf("Child")
    );
    const text = qi?.displayParts.map(p => p.text).join("");
    assert.match(text, /can suspend \(pending\)/);
    assert.equal(service.diagnostics(file).length, 0);
  } finally {
    service.dispose();
  }
});

test("foreign handoffs explain inferred failure classes; library roots may fail", () => {
  const source = `import {createMemo} from "solid-js";
 class NotFound extends Error {}
 declare function load(): number;
 export function DocPage(){
  const value=createMemo(()=>{if(Math.random()>0.5) throw new NotFound("missing");return load()});
  return <p>{value()}</p>;
 }
 export const route={component:DocPage};`;
  const { service } = makeService({ "failure.tsx": source });
  try {
    const ds = service.diagnostics(join(root, "failure.tsx"));
    const d = ds.find(d => d.messageText.includes("[FOREIGN_HANDOFF]"));
    assert.ok(d, JSON.stringify(ds.map(d => d.messageText)));
    assert.match(
      d.relatedInformation[0].messageText,
      /The app is rendered here.*can fail with .*NotFound.*unknown/
    );
    assert.match(
      d.messageText,
      /Wrap this rendered work in Errored, or handle the failure with attempt/
    );
    assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, 6);
  } finally {
    service.dispose();
  }
});

test("declaration edits invalidate the private checker", () => {
  const { service, input } = makeService(
    { "global.d.ts": "declare const item: number;", "plain.ts": "const n: number = item;" },
    {}
  );
  try {
    assert.equal(service.diagnostics(join(root, "plain.ts")).length, 0);
    input.set(join(root, "global.d.ts"), "declare const item: string;");
    assert.equal(service.diagnostics(join(root, "plain.ts"))[0].code, 2322);
  } finally {
    service.dispose();
  }
});
