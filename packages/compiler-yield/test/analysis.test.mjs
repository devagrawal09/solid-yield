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
