const test = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { makeService, makeHost, root, ts } = require("./helpers.cjs");
const text = d => ts.flattenDiagnosticMessageText(d.messageText, "\n");
test("unselected JSX consumers see original selected exports, not private generator contracts", () => {
  const producer = `import type { JSX } from "@solidjs/web";
import {createSignal,createContext} from "solid-js";
const Context=createContext<string>();
export function Panel(p:{children:JSX.Element;label:string}) {return <Context value={p.label}>{p.children}</Context>;}
export function Broken(){const [n]=createSignal(0);const value=n();return <p>{value}</p>;}`;
  const consumer = `/** @jsxImportSource @solidjs/web */
import {Panel} from "./producer";
export const page=<Panel label="valid"><span/><span/></Panel>;`;
  const { service, input } = makeService(
    { "producer.tsx": producer, "consumer.tsx": consumer },
    { mode: "native", include: ["producer.tsx"] }
  );
  const file = join(root, "consumer.tsx");
  const original = ts.createLanguageService(
    makeHost({ "producer.tsx": producer, "consumer.tsx": consumer })
  );
  try {
    assert.deepEqual(original.getSemanticDiagnostics(file).map(text), []);
  } finally {
    original.dispose();
  }
  try {
    assert.deepEqual(service.diagnostics(file).map(text), []);
    const qi = service.quickInfo(file, consumer.indexOf("Panel"));
    const shown = qi.displayParts.map(p => p.text).join("");
    assert.match(shown, /children: JSX.Element/);
    assert.doesNotMatch(shown, /Generator|ViewOp|Props</);
    assert.ok(
      service.diagnostics(join(root, "producer.tsx")).some(d => text(d).includes("[READ_IN_SETUP]"))
    );
    input.set(file, consumer.replace('label="valid"', "label={42}"));
    const errors = service.diagnostics(file);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].code, 2322);
    assert.match(text(errors[0]), /number.*not assignable.*string/);
    assert.ok(
      service.diagnostics(join(root, "producer.tsx")).some(d => text(d).includes("[READ_IN_SETUP]"))
    );
  } finally {
    service.dispose();
  }
});
test("unselected explicit-generator source keeps its authored generator types", () => {
  const source = `/** @jsxImportSource solid-yield */
import {component,view} from "solid-yield";
export const Item=component(function*(){return view(function*(){return <span/>;});});`;
  const file = join(root, "explicit.tsx");
  const { service, input } = makeService({ "explicit.tsx": source }, {});
  try {
    assert.deepEqual(service.diagnostics(file).map(text), []);
    const qi = service.quickInfo(file, source.indexOf("Item"));
    assert.match(qi.displayParts.map(p => p.text).join(""), /HoleCall/);
    input.set(file, source + '\nconst count:number="wrong";');
    assert.deepEqual(
      service.diagnostics(file).map(d => d.code),
      [2322]
    );
  } finally {
    service.dispose();
  }
});
function check(files, run) {
  const { service } = makeService(files);
  try {
    run(service);
  } finally {
    service.dispose();
  }
}
test("a refused native file retains authored Promise errors alongside its safety refusal", () => {
  const source = `/** @jsxImportSource @solidjs/web */
import {createSignal} from "solid-js";
export function App(){
  const [n,setN]=createSignal(0);
  const save=async()=>{setN(1);await Promise.resolve();return fetch("/x");};
  return <button onClick={async()=>{
    try {const r=save();setN(r.status);}
    catch(e){/* @yield-absorb: logged */console.error(e);}
  }}>{n()}</button>;
}`;
  const file = join(root, "promise.tsx");
  const original = ts.createLanguageService(makeHost({ "promise.tsx": source }));
  try {
    assert.ok(original.getSemanticDiagnostics(file).some(d => d.code === 2339));
  } finally {
    original.dispose();
  }
  check({ "promise.tsx": source }, service => {
    const ds = service.diagnostics(file);
    const state = service.refresh();
    assert.ok(state.selected.has(file));
    assert.equal(state.positions.has(file), false);
    assert.ok(
      ds.some(d => text(d).includes("[NATIVE_DETACHED_PROMISE]")),
      ds.map(text).join("\n")
    );
    const error = ds.find(d => d.code === 2339);
    assert.ok(error, ds.map(text).join("\n"));
    assert.match(text(error), /status.*Promise<Response>/);
    assert.equal(error.file.text, source);
    assert.equal(error.start, source.indexOf("status"));
    assert.deepEqual(
      ds.map(d => d.code).sort((a, b) => a - b),
      [2339, 95000]
    );
  });
});
test("refused explicit API source gets no invented original expression errors", () => {
  const source = `/** @jsxImportSource solid-yield */
import {component,view} from "solid-yield";
export const Item=component(function*(){return view(function*(){return <span/>;});});`;
  check({ "explicit.tsx": source }, service => {
    const ds = service.diagnostics(join(root, "explicit.tsx"));
    assert.ok(ds.some(d => text(d).includes("[NATIVE_LIBRARY]")));
    assert.ok(
      ds.every(d => d.code === 95000),
      ds.map(text).join("\n")
    );
  });
});
test("native checking retains Solid 2 rc13 original import errors", () => {
  const source = `import type { JSX } from "solid-js";
export function Desk(p: { children: JSX.Element }) { return <p>{p.children}</p>; }`;
  const file = join(root, "desk.tsx");
  const original = ts.createLanguageService(makeHost({ "desk.tsx": source }));
  try {
    assert.ok(original.getSemanticDiagnostics(file).some(d => d.code === 2305));
  } finally {
    original.dispose();
  }
  check({ "desk.tsx": source }, service => {
    const ds = service.diagnostics(file);
    assert.equal(ds.filter(d => d.code === 2305).length, 1);
    assert.equal(ds.find(d => d.code === 2305).start, source.indexOf("JSX"));
  });
});
test("hover-first original imports stay isolated through unsaved edits", () => {
  const invalid = `import type { JSX } from "solid-js";
import {createSignal} from "solid-js";
export function Desk(p:{count:number;children:JSX.Element}) {return <p>{p.count}{p.children}</p>;}
export function App(){const [count]=createSignal(1); return <Desk count={count()}><span/></Desk>;}`;
  const valid = invalid.replace('from "solid-js"', 'from "@solidjs/web"');
  const file = join(root, "desk.tsx");
  const { service, input } = makeService({ "desk.tsx": invalid });
  try {
    for (const source of [invalid, valid, "\n\n" + invalid]) {
      input.set(file, source);
      const qi = service.quickInfo(file, source.indexOf("Desk(p") + 5);
      assert.ok(qi);
      const state = service.refresh();
      assert.ok(state.originalLs, "the hover must exercise the original-source fallback");
      assert.equal(state.originalLs.getProgram().getSourceFile(file).text, source);
      const imports = service.diagnostics(file).filter(d => d.code === 2305);
      assert.equal(imports.length, source.includes('JSX } from "solid-js"') ? 1 : 0);
      if (imports.length) assert.equal(imports[0].start, source.indexOf("JSX"));
      assert.equal(state.ls.getSemanticDiagnostics(file).filter(d => d.code === 2305).length, 0);
    }
  } finally {
    service.dispose();
  }
});
test("import errors survive a refused lowering, without merging original JSX errors", () => {
  check(
    {
      "app.tsx": `import type { Missing } from "solid-js";
import {createSignal} from "solid-js";
declare function opaque(fn: () => number): void;
export function App(){const [n]=createSignal(0); opaque(() => n()); return <p/>;}`
    },
    service => {
      const ds = service.diagnostics(join(root, "app.tsx"));
      assert.ok(ds.some(d => d.code === 2305));
      assert.ok(ds.some(d => text(d).includes("[SUGAR_CALLBACK]")));
    }
  );
  check(
    {
      "app.tsx": `export function Bad(){throw new Error("bad");}
export function App(){return <Bad/>;}`
    },
    service => {
      assert.ok(service.diagnostics(join(root, "app.tsx")).every(d => d.code !== 2786));
    }
  );
});
test("a poisoned component does not add fake provider or failure errors in another file", () => {
  check(
    {
      "bad.tsx": `import {createSignal} from "solid-js";
export function Bad(){const [n]=createSignal(0); const x=n();return <p>{x}</p>;}`,
      "app.tsx": `import {Bad} from "./bad"; import {render} from "@solidjs/web";
function App(){return <Bad/>;} render(()=><App/>,document.body);`
    },
    service => {
      assert.ok(
        service.diagnostics(join(root, "bad.tsx")).some(d => text(d).includes("READ_IN_SETUP"))
      );
      const messages = service.diagnostics(join(root, "app.tsx")).map(text);
      assert.ok(messages.some(m => m.includes("[DEPENDENT_TYPE]")));
      assert.ok(messages.every(m => !/\[(NO_PROVIDER|FOREIGN_HANDOFF)\]/.test(m)));
    }
  );
});
test("an unrelated poisoned component does not hide real provider and failure obligations", () => {
  check(
    {
      "bad.tsx": `import {createSignal} from "solid-js";
export function Bad(){const [n]=createSignal(0); const x=n();return <p>{x}</p>;}`,
      "app.tsx": `import {Bad} from "./bad";
import {createContext,useContext} from "solid-js"; import {render} from "@solidjs/web";
const C=createContext<string>();
function Missing(){const c=useContext(C);return <p>{c}</p>;}
function Failing(){return <button onClick={()=>{throw new Error("real");}}>fail</button>;}
render(()=><Bad/>,document.body);
render(()=><Missing/>,document.body);
render(()=><Failing/>,document.body);`
    },
    service => {
      const messages = service.diagnostics(join(root, "app.tsx")).map(text);
      assert.ok(messages.some(m => m.includes("[NO_PROVIDER]") && m.includes("Missing: C")));
      assert.ok(messages.some(m => /\[(EVENT_REJECTS|FOREIGN_HANDOFF)\]/.test(m)));
      assert.ok(
        messages.every(m => !m.includes("Fix the earlier errors") && !m.includes("Missing: any"))
      );
    }
  );
});
test("a poisoned sibling cannot make a mixed render tree appear fully checked", () => {
  check(
    {
      "bad.tsx": `import {createSignal} from "solid-js";
export function Bad(){const [n]=createSignal(0); const x=n();return <p>{x}</p>;}`,
      "app.tsx": `import {Bad} from "./bad";
import {createContext,useContext} from "solid-js"; import {render} from "@solidjs/web";
const C=createContext<string>();
function Missing(){const c=useContext(C);return <p>{c}</p>;}
function Failing(){return <button onClick={()=>{throw new Error("real");}}>fail</button>;}
function App(){return <><Bad/><Missing/><Failing/></>;}
render(()=><App/>,document.body);`
    },
    service => {
      const messages = service.diagnostics(join(root, "app.tsx")).map(text);
      assert.ok(
        messages.some(m => m.includes("[DEPENDENT_TYPE]")),
        messages.join("\n")
      );
      assert.ok(
        messages.some(m => m.includes("[EVENT_REJECTS]")),
        messages.join("\n")
      );
      assert.ok(messages.every(m => !m.includes("Missing: any") && !m.includes("Remaining: any")));
      assert.ok(
        service.diagnostics(join(root, "bad.tsx")).some(d => text(d).includes("[READ_IN_SETUP]"))
      );
    }
  );
});
test("wrong reactive prop values report the value type, not the representation", () => {
  check(
    {
      "app.tsx": `import {createSignal} from "solid-js";
interface Ticket {id:number}
function TicketRow(p:{ticket:Ticket}) {return <p>{p.ticket.id}</p>}
export function App(){const [t]=createSignal<Ticket>({id:1}); return <TicketRow ticket={t().id}/>;}`
    },
    service => {
      const ds = service.diagnostics(join(root, "app.tsx"));
      assert.equal(ds.length, 1);
      assert.equal(ds[0].code, 2322);
      assert.equal(text(ds[0]), "Type 'number' is not assignable to type 'Ticket'.");
    }
  );
});
test("primitive held props accept their value type and reject other primitive types", () => {
  const source = value => `function Label(props:{value:string}){return <p>{props.value}</p>;}
export function App(){return <Label value={${value}}/>;}`;
  const file = join(root, "primitive.tsx");
  const { service, input } = makeService({ "primitive.tsx": source('"valid"') });
  try {
    for (const [value, actual] of [
      ['"valid"', null],
      ["42", "number"],
      ["true", "boolean"]
    ]) {
      input.set(file, source(value));
      const ds = service.diagnostics(file);
      if (!actual) assert.deepEqual(ds.map(text), []);
      else {
        assert.equal(ds.length, 1);
        assert.equal(ds[0].code, 2322);
        assert.equal(text(ds[0]), `Type '${actual}' is not assignable to type 'string'.`);
      }
    }
  } finally {
    service.dispose();
  }
});
test("a live callback still gets held-representation advice instead of a value-type error", () => {
  const source = value => `import{createSignal}from "solid-js";
function Label(props:{value:string}){return <p>{props.value}</p>;}
export function App(){const[n]=createSignal("ok");return <Label value={${value}}/>;}`;
  const file = join(root, "held.tsx");
  const { service, input } = makeService({ "held.tsx": source("n()") });
  try {
    assert.deepEqual(service.diagnostics(file).map(text), []);
    input.set(file, source("()=>n()"));
    const ds = service.diagnostics(file);
    assert.equal(ds.length, 1);
    assert.ok(text(ds[0]).includes("[HELD_PROP]"));
    input.set(file, source("n()"));
    assert.deepEqual(service.diagnostics(file).map(text), []);
  } finally {
    service.dispose();
  }
});
test("unknown setup failures are not described as authored throws", () => {
  check(
    { "app.tsx": `declare function risk():void; export function App(){risk(); return <p/>;}` },
    service => {
      const ds = service.diagnostics(join(root, "app.tsx"));
      assert.ok(ds.some(d => text(d).includes("[NATIVE_SETUP_FAILURE]")));
      assert.ok(ds.every(d => !/this throw/.test(text(d))));
      assert.ok(ds.some(d => /unknown|not known/.test(text(d))));
    }
  );
});
test("native handler advice gives a supported plain-Solid action", () => {
  check(
    {
      "app.tsx": `declare function risk():void;
export function App(){return <button onClick={()=>risk()}>save</button>;}`
    },
    service => {
      const ds = service.diagnostics(join(root, "app.tsx"));
      const messages = ds.map(text);
      assert.ok(messages.some(m => m.includes("[EVENT_REJECTS]")));
      assert.ok(messages.every(m => !/declare|fails contract|this throw/.test(m)));
      assert.ok(messages.some(m => /catch|Catch/.test(m)));
    }
  );
});
test("a callback already inside a memo keeps its refusal with honest invocation advice", () => {
  const source = `/** @jsxImportSource @solidjs/web */
import{createSignal,createMemo}from "solid-js";
declare function opaque(callback:()=>number):number;
export function App(){const[n]=createSignal(0);const value=createMemo(()=>opaque(()=>n()));return <p>{value()}</p>;}`;
  check({ "callback.tsx": source }, service => {
    const ds = service.diagnostics(join(root, "callback.tsx"));
    const refusal = ds.find(d => text(d).includes("[SUGAR_CALLBACK]"));
    assert.ok(refusal, ds.map(text).join("\n"));
    assert.equal(refusal.category, ts.DiagnosticCategory.Error);
    assert.match(text(refusal), /cannot prove when or where this callback runs/);
    assert.match(text(refusal), /function receiving it/);
    assert.doesNotMatch(text(refusal), /Move this reactive read|declare.*failure|generator/);
  });
});
