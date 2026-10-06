import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/analysis.js";
import compilerYield from "../src/index.js";
const prefix =
  'import {component,view,$signal,$store,$optimistic,$memo,$event,$effect,constant,foreignSource,attempt,For,Show,Loading,Errored,createContext} from "solid-yield";';
const run = body => analyze(new Map([["/fixture.tsx", prefix + body]]));
const app = body => `const App=component(function*(){${body}});`;

test("1.1/1.2: an unwritten cell and its memo are S; a delegated write makes both C", () => {
  const src = app(
    "const [n,set]=yield* $signal(0);const m=yield* $memo(function*(){return yield* n});REPLACE return view(function*(){return <b>{yield* m}</b>});"
  );
  const inert = run(src.replace("REPLACE", ""));
  assert.deepEqual(
    inert.sources.map(x => x.provenance),
    ["S", "S"]
  );
  const changed = run(src.replace("REPLACE", "const click=$event(function*(){yield* set(1)});"));
  assert.deepEqual(
    changed.sources.map(x => x.provenance),
    ["C", "C"]
  );
});
test("1.2: source paths preserve provenance; optimistic cells are always C", () => {
  const a = run(
    app(
      "const [n,set]=yield* $optimistic({x:1});return view(function*(){return <b>{yield* n.x}</b>});"
    )
  );
  assert.equal(a.sources[0].provenance, "C");
  assert.equal(a.holes.inert, 0);
});
test("1.2: server attempts with S arguments are S; other targets are named U", () => {
  const a = run(
    'async function fetchValue(){"use server";return 1;}' +
      app(
        "const m=yield* $memo(function*(){return yield* attempt(()=>fetchValue(),e=>new Error(e));});return view(function*(){return <b>{yield* m}</b>});"
      )
  );
  assert.equal(a.sources[0].provenance, "S");
  const b = run(
    app(
      'const m=yield* $memo(function*(){return yield* attempt(()=>fetch("/data"),e=>new Error(e));});return view(function*(){return <b>{yield* m}</b>});'
    )
  );
  assert.equal(b.sources[0].provenance, "U");
  assert(b.leaks.some(x => x.reason.includes("attempt target")));
});
test("1.2: props flow from call arguments (joined cap is explicit)", () => {
  const child =
    "const Child=component(function*(props){return view(function*(){return <b>{yield* props.x}</b>});});";
  const a = run(child + app("return view(function*(){return <>{yield* Child({x:1})}</>});"));
  assert.equal(a.components.find(x => x.name === "Child").inert, true);
  const b = run(
    child +
      app(
        "const [x,set]=yield* $optimistic(1);return view(function*(){return <>{yield* Child({x})}</>});"
      )
  );
  assert.equal(b.components.find(x => x.name === "Child").inert, false);
  assert.equal(b.definitions.contextSensitivityCap, 1);
});
test("1.2: one prop's provenance does not contaminate a different prop", () => {
  const a = run(
    "const Child=component(function*(props){const m=yield* $memo(function*(){return yield* props.label});return view(function*(){return <b>{yield* m}</b>});});" +
      app(
        "const [n,set]=yield* $optimistic(1);return view(function*(){return <>{yield* Child({label:'fixed',unused:n})}</>});"
      )
  );
  assert.equal(a.sources.find(x => x.kind === "memo").provenance, "S");
});
test("1.2: a reassigned binding never inherits S from its initializer", () => {
  const a = run(
    "let current=0;current=window.value;" +
      app(
        "const m=yield* $memo(function*(){return current});return view(function*(){return <b>{yield* m}</b>});"
      )
  );
  assert.equal(a.sources[0].provenance, "U");
  assert(a.leaks.some(x => x.reason === "mutable binding"));
});
test("1.2: a const object with a member write is unknown", () => {
  const a = run(
    "const state={value:0};state.value=window.value;" +
      app(
        "const m=yield* $memo(function*(){return state.value});return view(function*(){return <b>{yield* m}</b>});"
      )
  );
  assert.equal(a.sources[0].provenance, "U");
});
test("1.1: writes through a setter alias still make its cell client", () => {
  const a = run(
    app(
      "const [n,set]=yield* $signal(0);const write=set;const click=$event(function*(){yield* write(1)});return view(function*(){return <button onClick={yield* click}>{yield* n}</button>});"
    )
  );
  assert.equal(a.sources[0].provenance, "C");
  assert.equal(a.sources[0].written, true);
});
test("1.2: an effect compute read does not make an unwritten cell C", () => {
  const a = run(
    app(
      "const [n,set]=yield* $signal(0);yield* $effect(function*(){return yield* n},function*(){});return view(function*(){return <b>{yield* n}</b>});"
    )
  );
  assert.equal(a.sources[0].provenance, "S");
  assert.equal(a.roots[0].mode, "eager");
});
test("1.2: a server memo with a client key remains C", () => {
  const a = run(
    'async function fetchValue(x){"use server";return x;}' +
      app(
        "const [key,set]=yield* $optimistic(1);const m=yield* $memo(function*(){const x=yield* key;return yield* attempt(()=>fetchValue(x),e=>new Error(e))});return view(function*(){return <b>{yield* m}</b>});"
      )
  );
  assert.equal(a.sources.find(x => x.kind === "memo").provenance, "C");
});
test("1.2: context includes every provider and its default", () => {
  const a = run(
    'import {unknown} from "foreign";const Ctx=createContext(unknown);' +
      app(
        "return view(function*(){return <>{yield* Ctx.provide({value:1,children:function*(){return <p/>}})}</>});"
      )
  );
  assert(a.leaks.some(x => x.reason.includes("import")));
  assert.equal(a.components[0].inert, false);
});
test("D-098: a required context from an unseen provider is U, never S", () => {
  const a = run(
    "const Ctx=createContext();" +
      app("const n=yield* Ctx;return view(function*(){return <b>{yield* n}</b>});")
  );
  assert.equal(a.components[0].provenance, "U");
  assert(a.leaks.some(x => x.name === "Ctx" && x.reason.includes("required context")));
});
test("D-098: a provider for a different context does not discharge the unknown", () => {
  const a = run(
    "const Ctx=createContext();const Other=createContext();" +
      app(
        "const n=yield* Ctx;return view(function*(){return <>{yield* Other.provide({value:1,children:function*(){return <b>{yield* n}</b>}})}</>});"
      )
  );
  assert.equal(a.components[0].provenance, "U");
  assert(a.leaks.some(x => x.name === "Ctx"));
  assert(!a.leaks.some(x => x.name === "Other"));
});
test("1.2: server module exports resolve through named re-exports", () => {
  const a = analyze(
    new Map([
      ["/server.ts", '"use server";export async function get(){return 1}'],
      ["/barrel.ts", 'export {get as load} from "./server.ts";'],
      [
        "/app.tsx",
        prefix +
          'import {load} from "./barrel.ts";' +
          app(
            "const m=yield* $memo(function*(){return yield* attempt(()=>load(),e=>new Error(e))});return view(function*(){return <b>{yield* m}</b>});"
          )
      ]
    ])
  );
  assert.equal(a.sources[0].provenance, "S");
});
test("1.2: context joins providers through its resolved binding", () => {
  const a = run(
    "const Ctx=createContext(0);const Child=component(function*(){const n=yield* Ctx;return view(function*(){return <b>{yield* n}</b>});});" +
      app(
        "const [n,set]=yield* $optimistic(1);return view(function*(){return <>{yield* Ctx.provide({value:n,children:function*(){return <>{yield* Child()}</>}})}</>});"
      )
  );
  assert.equal(a.components.find(x => x.name === "Child").inert, false);
  assert(a.merges.some(x => x.rule === "M3"));
});
test("1.3: static markup is inert; foreign tags and bound events are not", () => {
  assert.equal(
    run(app("return view(function*(){return <p>hello</p>});")).components[0].inert,
    true
  );
  assert.equal(run(app("return view(function*(){return <Foreign/>});")).components[0].inert, false);
  assert.equal(
    run(
      app(
        "const click=$event(function*(){});return view(function*(){return <button onClick={yield* click}/>});"
      )
    ).components[0].inert,
    false
  );
});
test("1.4/M1/M2: two readers and a writer share one connected root", () => {
  const a = run(
    app(
      "const [n,set]=yield* $signal(0);const click=$event(function*(){yield* set(1)});return view(function*(){return <div><b>{yield* n}</b><button onClick={yield* click}>{yield* n}</button></div>});"
    )
  );
  assert.equal(a.roots.length, 1);
  assert(a.merges.some(x => x.rule === "M1"));
  assert(a.merges.some(x => x.rule === "M2"));
});
test("1.5/M4/M5: boundaries and recreated rows merge", () => {
  const a = run(
    app(
      'const m=yield* $memo(function*(){return yield* attempt(()=>fetch("/data"),e=>new Error(e))});return view(function*(){return <>{yield* Loading({children:function*(){return <>{yield* For({each:m,children:function*(row){return view(function*(){return <b>{yield* row}</b>});}})}</>}})}</>});'
    )
  );
  assert(a.merges.some(x => x.rule === "M4"));
  assert(a.merges.some(x => x.rule === "M5"));
});
test("1.5/M6: the same unknown binding merges its readers", () => {
  const a = run(
    'import {source} from "foreign";' +
      app(
        "return view(function*(){return <div><b>{yield* source}</b><i>{yield* source}</i></div>});"
      )
  );
  assert.equal(a.roots.length, 1);
  assert(a.merges.some(x => x.rule === "M6"));
  assert.equal(a.roots[0].mode, "visible");
});
test("1.6: captures name the setup-local variable", () => {
  const a = run(
    app(
      "const value=new Thing();const click=$event(function*(){value.run()});return view(function*(){return <button onClick={yield* click}/>});"
    )
  );
  assert(a.captureFailures.some(x => x.variable === "value"));
});
test("1.7: effects are eager, async foreign data visible, binds lazy", () => {
  const eager = run(
    app("yield* $effect(function*(){},function*(){});return view(function*(){return <p/>});")
  );
  assert.equal(eager.roots[0].mode, "eager");
  assert.equal(eager.roots[0].effectReach.length, 1);
  const visible = run(
    app(
      'const m=yield* $memo(function*(){return yield* attempt(()=>fetch("/data"),e=>new Error(e))});return view(function*(){return <b>{yield* m}</b>});'
    )
  );
  assert.equal(visible.roots[0].mode, "visible");
  const lazy = run(
    app(
      "const click=$event(function*(){});return view(function*(){return <button onClick={yield* click}/>});"
    )
  );
  assert.equal(lazy.roots[0].mode, "lazy");
});
test("Q5: foreignSource is one named leak even with a literal getter", () => {
  const a = run(
    "const s=foreignSource(()=>1);" +
      app(
        "const m=yield* $memo(function*(){return yield* attempt(()=>s,e=>new Error(e))});return view(function*(){return <b>{yield* m}</b>});"
      )
  );
  assert.equal(a.sources.find(x => x.kind === "foreign-source").provenance, "U");
  assert.equal(a.leaks.length, 1);
  assert.equal(a.leaks[0].reason, "foreignSource: always unknown");
});
test("imports: aliases are recognised, shadowed routine names are not", () => {
  const a = analyze(
    new Map([
      [
        "/f.ts",
        'import { $signal as signal, component as c } from "solid-yield"; const A=c(function*(){ const [n,s]=yield* signal(0); });'
      ]
    ])
  );
  assert.equal(a.sources.length, 1);
  const b = run("function f($signal){return $signal(1)}");
  assert.equal(b.sources.length, 0);
});
test("C1 plugin: pre-pass does not rewrite modules and reports at build end", async () => {
  let report;
  const plugin = compilerYield({
    onReport: r => {
      report = r;
    }
  });
  const context = { resolve: async () => null, warn: () => {} };
  plugin.buildStart();
  assert.equal(plugin.enforce, "pre");
  assert.equal(
    await plugin.transform.call(
      context,
      prefix + app("return view(function*(){return <p/>});"),
      "/fixture.tsx"
    ),
    null
  );
  plugin.buildEnd.call(context);
  assert.equal(report.components.length, 1);
});

test("C0 gap: disjoint state can have overlapping spans; never allow two claims on one span", () => {
  const a = run(
    app(
      "const [a,sa]=yield* $signal(0);const [b,sb]=yield* $signal(0);const ca=$event(function*(){yield* sa(1)});const cb=$event(function*(){yield* sb(1)});return view(function*(){return <div><b>{yield* a}</b><i>{yield* b}</i><button onClick={yield* ca}/><button onClick={yield* cb}/></div>});"
    )
  );
  assert(a.merges.some(x => x.rule === "SPAN_OVERLAP"));
  assert.equal(a.roots.length, 1);
  assert(a.roots[0].span);
});

// The instance engine is tested beside the previous report until its twin audit lands.
import { analyzeInstances } from "../src/placement.js";
const instances = body => analyzeInstances(new Map([["/fixture.tsx", prefix + body]]));
test("instances: the same component called twice owns two independent cells", () => {
  const result = instances(
    "const Counter=component(function*(props){const [n,set]=yield* $signal(0);const click=$event(function*(){yield* set(1)});return view(function*(){return <button onClick={yield* click}>{yield* n}</button>});});" +
      app(
        "return view(function*(){return <main><section>{yield* Counter()}</section><aside>{yield* Counter()}</aside></main>});"
      )
  );
  assert.equal(result.sources.length, 2);
  assert.equal(result.roots.length, 2);
  assert.equal(new Set(result.sources.map(x => x.instance)).size, 2);
  assert(result.roots.every(x => x.span && x.mode === "lazy"));
});
test("instances: props from separate calls retain their own provenance", () => {
  const result = instances(
    "const Child=component(function*(props){const m=yield* $memo(function*(){return yield* props.x});return view(function*(){return <b>{yield* m}</b>});});" +
      app(
        "const [n,set]=yield* $optimistic(0);return view(function*(){return <main>{yield* Child({x:1})}{yield* Child({x:n})}</main>});"
      )
  );
  assert.deepEqual(
    result.sources.filter(x => x.kind === "memo").map(x => x.provenance),
    ["S", "C"]
  );
});
test("instances: generator helpers create state in their caller", () => {
  const result = instances(
    "function* state(){const [n,set]=yield* $signal(0);const click=$event(function*(){yield* set(1)});return {n,click};}" +
      app(
        "const {n,click}=yield* state();return view(function*(){return <button onClick={yield* click}>{yield* n}</button>});"
      )
  );
  assert.equal(result.sources[0].provenance, "C");
  assert.equal(result.roots.length, 1);
  assert.equal(result.roots[0].components[0], "App");
  assert.equal(result.leaks.length, 0);
});
test("instances: inert markup inside a root is a slot", () => {
  const result = instances(
    app(
      "const [n,set]=yield* $signal(0);const click=$event(function*(){yield* set(1)});return view(function*(){return <main><b>{yield* n}</b><p>server copy</p><button onClick={yield* click}/></main>});"
    )
  );
  assert.equal(result.roots.length, 1);
  assert.equal(result.roots[0].slots.length, 1);
});
test("instances: h source children and event props have parts and DOM owners", () => {
  const result = instances(
    'import {h} from "solid-yield/h";' +
      app(
        'const [n,set]=yield* $signal(0);const click=$event(function*(){yield* set(1)});return view(function*(){return h("button",{onClick:click},n)});'
      )
  );
  assert.equal(result.holes.total, 2);
  assert.equal(result.roots.length, 1);
  assert.equal(result.roots[0].spanKind, "element");
  assert.equal(result.leaks.length, 0);
});

test("instances: GET preserves server provenance; live keeps client lifetime unknown", () => {
  const result = instances(
    'import {GET,live} from "@solidjs/web/server-functions";const get=GET(async ()=>{"use server";return 1});const watch=live(get);' +
      app(
        "const a=yield* $memo(function*(){return yield* attempt(()=>get(),e=>e)});const b=yield* $memo(function*(){return yield* attempt(()=>watch(),e=>e)});return view(function*(){return <main><b>{yield* a}</b><i>{yield* b}</i></main>});"
      )
  );
  assert.deepEqual(
    result.sources.map(x => x.provenance),
    ["S", "U"]
  );
  assert.equal(result.leaks.length, 1);
  assert.equal(result.leaks[0].classification, "genuine");
});
test("instances: boundary accessors and stable IDs do not invent U", () => {
  const result = instances(
    'import {createUniqueId} from "solid-js";' +
      app(
        "const id=createUniqueId();return view(function*(){return <>{yield* Errored({fallback:(err,reset)=><button id={id} onClick={reset}>{String(err())}</button>,children:function*(){return <p/>}})}</>});"
      )
  );
  assert.equal(result.leaks.length, 0);
});
test("instances: helper assignment to a module callback keeps one creator", () => {
  const result = instances(
    "let sink;function* create(){const [n,set]=yield* $signal(0);const write=$event(function*(){yield* set(1)});sink=write;return n;}" +
      app("const n=yield* create();return view(function*(){return <b>{yield* n}</b>});")
  );
  assert.equal(result.sources.length, 1);
  assert(result.sources.every(x => x.instance));
});
test("instances: overlapping spans merge, recreated content is never a slot", () => {
  const result = instances(
    app(
      "const [a,sa]=yield* $signal(0);const [b,sb]=yield* $signal(0);const ca=$event(function*(){yield* sa(1)});const cb=$event(function*(){yield* sb(1)});return view(function*(){return <div><i>{yield* a}</i><i>{yield* b}</i><button onClick={yield* ca}/><button onClick={yield* cb}/>{yield* Show({when:a,children:function*(){return <p>rebuilt</p>}})}</div>});"
    )
  );
  assert.equal(result.roots.length, 1);
  assert(result.merges.some(x => x.rule === "SPAN_OVERLAP"));
  assert.equal(result.roots[0].slots.length, 0);
});
test("instances: opaque setup work and direct timers make their owner eager", () => {
  const result = instances(
    'import {start} from "opaque";' +
      app(
        "start();const click=$event(function*(){});setInterval(click,10);return view(function*(){return <button onClick={yield* click}/>});"
      )
  );
  assert(result.roots.every(x => x.mode === "eager"));
  assert(result.findings.some(x => x.message.includes("setInterval")));
});
test("instances: a setup instance crossing into a child names the capture", () => {
  const result = instances(
    "class Box {} const Child=component(function*(props){const click=$event(function*(){consume(props.box)});return view(function*(){return <button onClick={yield* click}/>});});" +
      app(
        "const box=new Box();return view(function*(){return <main>{yield* Child({box})}</main>});"
      )
  );
  assert(result.captureFailures.some(x => x.variable === "box"));
  assert.equal(result.roots.length, 1);
});

test("instances: foreign imported values are one named shared U origin", () => {
  const result = instances(
    'import {data} from "foreign";' +
      app(
        "return view(function*(){return <main><b>{yield* data.x}</b><i>{yield* data.y}</i></main>});"
      )
  );
  assert.equal(result.holes.inert, 0);
  assert.equal(result.leaks.length, 1);
  assert.equal(result.roots.length, 1);
  assert(result.merges.some(x => x.rule === "M6"));
});
test("instances: recursive hole props widen from S to C", () => {
  const result = instances(
    "const Child=component(function*(props){const [n,set]=yield* $optimistic(1);const m=yield* $memo(function*(){return yield* props.x});return view(function*(){return <main><b>{yield* m}</b>{yield* Child({x:function*(){return yield* n}})}</main>});});" +
      app("return view(function*(){return <>{yield* Child({x:0})}</>});")
  );
  assert.equal(result.sources.find(x => x.kind === "memo").provenance, "C");
  assert(result.components.some(x => x.recursive));
});
test("instances: a server-pending input does not make an event-only root visible", () => {
  const result = instances(
    'async function get(){"use server";return 1;}' +
      app(
        "const m=yield* $memo(function*(){return yield* attempt(()=>get(),e=>e)});const click=$event(function*(){const x=yield* m; consume(x)});return view(function*(){return <button onClick={yield* click}/>});"
      )
  );
  assert.equal(result.roots[0].mode, "lazy");
});
test("instances: nested independent roots become slots instead of forced merges", () => {
  const result = instances(
    "const Child=component(function*(){const [n,set]=yield* $signal(0);const click=$event(function*(){yield* set(1)});return view(function*(){return <button onClick={yield* click}>{yield* n}</button>});});" +
      app(
        "const [n,set]=yield* $signal(0);const click=$event(function*(){yield* set(1)});return view(function*(){return <main><button onClick={yield* click}/>{yield* Child()}<b>{yield* n}</b></main>});"
      )
  );
  assert.equal(result.roots.length, 2);
  assert(result.roots.some(x => x.slots.some(s => s.kind === "client-root")));
});
test("instances: opaque foreign ownership prevents an unproved inert slot", () => {
  const result = instances(
    'import {Foreign} from "foreign";' +
      app("return view(function*(){return <Foreign><p>copy</p></Foreign>});")
  );
  assert.equal(result.roots.length, 1);
  assert.equal(result.roots[0].slots.length, 0);
});

test("instances: a local async literal is U unless declared use server", () => {
  const r = instances(
    "async function data(){return 1;}" +
      app(
        "const n=yield* $memo(function*(){return yield* attempt(()=>data(),e=>e)});return view(function*(){return <b>{yield* n}</b>});"
      )
  );
  assert.equal(r.sources[0].provenance, "U");
  assert.equal(r.leaks.length, 1);
});
test("instances: top-level reassignment is followed without entering nested helpers", () => {
  const r = instances(
    "let data=0;data=window.value;" +
      app(
        "const n=yield* $memo(function*(){return data});return view(function*(){return <b>{yield* n}</b>});"
      )
  );
  assert.equal(r.sources[0].provenance, "C");
});
test("instances: an opaque class method is not guessed pure from its name", () => {
  const r = instances(
    "class Thing {map(){return window.data}}" +
      app(
        "const thing=new Thing();const n=yield* $memo(function*(){return thing.map()});return view(function*(){return <b>{yield* n}</b>});"
      )
  );
  assert.equal(r.sources[0].provenance, "U");
  assert(r.leaks.some(x => x.classification === "blind spot"));
});

test("audit: imported values stay U through expressions, cells and helpers", () => {
  for (const value of ["data + 1", "String(data)", "identity(data)", "({x:data}).x"]) {
    const r = instances(
      'import {data} from "opaque";function identity(x){return x;}' +
        app(
          `const [n]=yield* $signal(${value});return view(function*(){return <b>{yield* n}</b>});`
        )
    );
    assert.equal(r.sources[0].provenance, "U", value);
    assert.equal(r.leaks.length, 1, value);
  }
});
test("audit: recursive initial hole props cannot hide later client inputs", () => {
  const r = instances(
    "const Child=component(function*(props){const [n]=yield* $optimistic(1);const m=yield* $memo(function*(){return yield* props.x});return view(function*(){return <main><b>{yield* m}</b>{yield* Child({x:function*(){return yield* n}})}</main>});});" +
      app("return view(function*(){return <>{yield* Child({x:function*(){return 0}})}</>});")
  );
  assert.equal(r.sources.find(x => x.kind === "memo").provenance, "C");
});
test("audit: recursive widening does not taint another call's shared S argument", () => {
  const r = instances(
    "const fixed=0;const Child=component(function*(props){const [n]=yield* $optimistic(1);return view(function*(){return <main>{yield* props.x}{yield* Child({x:n})}</main>});});const Label=component(function*(props){const m=yield* $memo(function*(){return yield* props.x});return view(function*(){return <b>{yield* m}</b>});});" +
      app(
        "return view(function*(){return <>{yield* Child({x:fixed})}{yield* Label({x:fixed})}</>});"
      )
  );
  assert.equal(r.sources.find(x => x.kind === "memo").provenance, "S");
});
test("audit: foreign-owned independent child roots cannot become slots", () => {
  const r = instances(
    'import {Foreign} from "opaque";const Child=component(function*(){const [n,set]=yield* $signal(0);const click=$event(function*(){yield* set(1)});return view(function*(){return <button onClick={yield* click}>{yield* n}</button>});});' +
      app("return view(function*(){return <Foreign><p>copy</p>{yield* Child()}</Foreign>});")
  );
  assert.equal(r.roots.length, 1);
  assert.equal(r.roots[0].slots.length, 0);
  assert(r.merges.some(x => x.rule === "FOREIGN_OWNER"));
});
test("audit: recursive opaque props widen every previously known field", () => {
  const r = instances(
    'import {data} from "opaque";const Child=component(function*(props){const m=yield* $memo(function*(){return yield* props.x});return view(function*(){return <main>{yield* m}{yield* Child(data)}</main>});});' +
      app("return view(function*(){return <>{yield* Child({x:0})}</>});")
  );
  assert.equal(r.sources[0].provenance, "U");
  assert.equal(r.leaks.length, 1);
});
