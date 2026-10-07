import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeReachability, partName, authoredRanges } from "../src/reachability.js";
import {
  bytesOf,
  unionRanges,
  differenceRanges,
  projectRanges
} from "../src/reachability-bytes.js";
const imports =
  'import {component,view,$signal,$store,$optimistic,$memo,$event,$effect,attempt,readStore,refresh,createContext,For,Show,Errored} from "solid-yield";';
const run = body => analyzeReachability(new Map([["/fixture.tsx", imports + body]])).graph;
const app = body => `const App=component(function*(){${body}});`;
const event = (g, name) => g.events.find(e => e.binding?.name === name);
const names = set =>
  [...set]
    .map(p => p.binding?.name)
    .filter(Boolean)
    .sort();

test("direction: a pending pre-write read is needed but its other consumers do not wake", () => {
  const g = run(
    app(
      "const [x,setX]=yield* $signal(0); const [y]=yield* $signal(1); const m=yield* $memo(function*(){return yield* y}); const go=$event(function*(){const old=yield* m;yield* setX(old)}); return view(function*(){return <><button onClick={yield* go}>{yield* x}</button><b>{yield* m}</b></>});"
    )
  );
  const r = g.reach([event(g, "go")]);
  assert.deepEqual(names(r.writes), ["x"]);
  assert.deepEqual(names(r.reads), ["m", "x", "y"]);
  assert.equal([...r.parts].filter(p => p.kind === "hole").length, 1);
});
test("optimistic and absorbed failure writes are included", () => {
  const g = run(
    app(
      'const [p,sp]=yield* $optimistic(false);const [err,se]=yield* $signal(null); const go=$event(function*(){yield* sp(true);yield* attempt(()=>fetch("/"),function*(e){yield* se(e)})});return view(function*(){return <button onClick={yield* go}>{yield* p}{yield* err}</button>});'
    )
  );
  assert.deepEqual(names(g.reach([event(g, "go")]).writes), ["err", "p"]);
});
test("called events through context and computed action alternatives reach their stores", () => {
  const g = run(
    "const C=createContext();const Child=component(function*(){const {actions}=yield* C;const go=$event(function*(e){yield* actions[e.type]()});return view(function*(){return <button onClick={yield* go}/>})});" +
      app(
        "const [x,sx]=yield* $signal(0);const [y,sy]=yield* $signal(0); const a=$event(function*(){yield* sx(1)});const b=$event(function*(){yield* sy(1)});return view(function*(){return C.provide({value:{actions:{a,b}},children:function*(){return Child({})}})});"
      )
  );
  assert.deepEqual(names(g.reach([event(g, "go")]).writes), ["x", "y"]);
});
test("returned fallback generators have their own callback cache entry", () => {
  const g = run(
    "function fallback(set){return function*(){const retry=$event(function*(){yield* set(1)});return view(function*(){return <button onClick={yield* retry}/>})}}" +
      app(
        "const [n,set]=yield* $signal(0);return view(function*(){return Errored({fallback:fallback(set),children:function*(){return <b>{yield* n}</b>}})})"
      )
  );
  assert(event(g, "retry"));
  assert.deepEqual(names(g.reach([event(g, "retry")]).writes), ["n"]);
});
test("events from repeated helper calls each retain their writes", () => {
  const g = run(
    app(
      "const [n,set]=yield* $signal(0);const pick=x=>$event(function*(){yield* set(x)});return view(function*(){return <><button onClick={yield* pick(1)}/><button onClick={yield* pick(2)}/></>})"
    )
  );
  assert.equal(g.events.length, 2);
  for (const e of g.events) assert.deepEqual(names(g.reach([e]).writes), ["n"]);
});
test("flow recreation does not invoke its newly bound handlers", () => {
  const g = run(
    app(
      "const [on,so]=yield* $signal(false); const [x,sx]=yield* $signal(0);const open=$event(function*(){yield* so(true)}); return view(function*(){return <><button onClick={yield* open}/>{yield* Show({when:on,children:function*(){const hidden=$event(function*(){yield* sx(1)});return view(function*(){return <button onClick={yield* hidden}>{yield* x}</button>})}})}</>})"
    )
  );
  const r = g.reach([event(g, "open")]);
  assert(!r.writes.has(g.parts.find(p => p.binding?.name === "x")));
  assert(!r.parts.has(event(g, "hidden")));
});
test("effect writes propagate to the next memo and hole", () => {
  const g = run(
    app(
      "const [x,sx]=yield* $signal(0);const [y,sy]=yield* $signal(0);yield* $effect(function*(){return yield* x},function*(v){yield* sy(v)});const m=yield* $memo(function*(){return yield* y});const go=$event(function*(){yield* sx(1)});return view(function*(){return <button onClick={yield* go}>{yield* m}</button>})"
    )
  );
  assert.deepEqual(names(g.reach([event(g, "go")]).writes), ["m", "x", "y"]);
});
test("store updaters read prior data; refresh is a write", () => {
  const g = run(
    app(
      "const [rows,set]=yield* $store([]);const go=$event(function*(){yield* set(r=>r.concat([1]));yield* refresh(rows)});return view(function*(){return <button onClick={yield* go}>{yield* rows.length}</button>})"
    )
  );
  const r = g.reach([event(g, "go")]);
  assert.deepEqual(names(r.writes), ["rows"]);
  assert.deepEqual(names(r.reads), ["rows"]);
  assert(authoredRanges(event(g, "go"), g.a).length >= 2);
});
test("a property call never invokes its receiver's creator", () => {
  const g = run(
    "function make(){const go=$event(function*(){}); return {go}}" +
      app(
        "const obj=make();const cancel=$event(function*(){obj.missing()});return view(function*(){return <button onClick={yield* cancel}/>})"
      )
  );
  assert.equal(g.events.length, 2);
  assert.equal(g.reach([event(g, "cancel")]).parts.size, 1);
});
test("UTF-8 union, overlap, repeated steps and source-map projection", () => {
  const code = "aé😀z";
  assert.equal(
    bytesOf(code, [
      { start: 0, end: 4 },
      { start: 1, end: 4 }
    ]),
    7
  );
  assert.deepEqual(
    unionRanges([
      { start: 2, end: 5 },
      { start: 0, end: 3 }
    ]),
    [{ start: 0, end: 5 }]
  );
  assert.deepEqual(differenceRanges([{ start: 0, end: 5 }], [{ start: 1, end: 4 }]), [
    { start: 0, end: 1 },
    { start: 4, end: 5 }
  ]);
  const projected = projectRanges(
    "ab",
    "aaébb",
    { version: 3, sources: ["in.js"], names: [], mappings: "AAAA,GAAE" },
    [{ start: 0, end: 1 }]
  );
  assert.equal(bytesOf("aaébb", projected), 4);
  assert.equal(differenceRanges(projected, projected).length, 0);
});

test("a failed pending source reaches its boundary's error holes", () => {
  const g = run(
    app(
      'const [q,sq]=yield* $signal("");const m=yield* $memo(function*(){yield* q;return yield* attempt(()=>fetch("/"),e=>e)});const go=$event(function*(){yield* sq("x")});return view(function*(){return <><button onClick={yield* go}/>{yield* Errored({children:function*(){return <b>{yield* m}</b>},fallback:err=><i>{err().message}</i>})}</>})'
    )
  );
  const reached = g.reach([event(g, "go")]);
  assert([...reached.parts].some(p => p.kind === "boundary"));
  assert([...reached.parts].some(p => p.path.toString().includes("err().message")));
});

test("bound runtime reset is an event and reaches the failed source", () => {
  const g = run(
    app(
      'const m=yield* $memo(function*(){return yield* attempt(()=>fetch("/"),e=>e)});return view(function*(){return Errored({children:function*(){return <b>{yield* m}</b>},fallback:(err,reset)=><button onClick={reset}>{err().message}</button>})})'
    )
  );
  const reset = event(g, "reset");
  assert(reset && g.bound.has(reset));
  assert(g.reach([reset]).parts.has(g.parts.find(p => p.binding?.name === "m")));
});
