const test = require("node:test");
const assert = require("node:assert/strict");
const { makeService, root } = require("./helpers.cjs");
const { join } = require("node:path");
test("directive sugar shares the service and updates positions after edits", () => {
  const name = "sugar.tsx",
    file = join(root, name);
  const source =
    '"use yield";\nimport {$signal} from "solid-yield";\nexport function Counter(){\n const [n]=$signal(0);\n const x=n();\n return <p>{x}</p>;\n}';
  const { service, input } = makeService({ [name]: source }, {});
  try {
    let ds = service.diagnostics(file);
    assert.equal(ds.length, 1);
    assert.match(ds[0].messageText, /READ_IN_SETUP/);
    assert.equal(ds[0].file.getLineAndCharacterOfPosition(ds[0].start).line + 1, 5);
    input.set(file, "\n\n" + source);
    ds = service.diagnostics(file);
    assert.equal(ds[0].file.getLineAndCharacterOfPosition(ds[0].start).line + 1, 7);
    input.set(file, source.replace("const x=n();", "const x=1;"));
    assert.equal(service.diagnostics(file).length, 0);
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
      /Component DocPage.*can fail with .*NotFound.*unknown/
    );
    assert.match(
      d.messageText,
      /Wrap this rendered work in Errored, or handle the failure with attempt/
    );
    assert.equal(d.file.getLineAndCharacterOfPosition(d.start).line + 1, 5);
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
