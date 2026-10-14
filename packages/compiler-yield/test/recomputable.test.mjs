import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRecomputable } from "../src/recomputable.js";
const analyze = body =>
  analyzeRecomputable(
    new Map([
      [
        "/fixture.tsx",
        `
import {component,view,$memo,$signal,$event,attempt,foreignSource,Errored,Loading} from "solid-yield";
async function load(slug: string) { "use server"; return {title: slug}; }
class Missing extends Error {}
const App=component(function* App(){ ${body} });
`
      ]
    ])
  );
const memo = arg =>
  `const article=yield* $memo(function*(){const key=${arg};return yield* attempt(()=>load(key),e=>new Missing(e));});`;

test("R: serializable unknown argument cuts server data provenance and pure derivations follow", () => {
  const r = analyze(
    `const slug=foreignSource(()=>"a"); ${memo("yield* slug")} const title=yield* $memo(function*(){return (yield* article.title).toUpperCase();}); return view(function*(){return <h1>{yield* title}</h1>});`
  );
  assert.deepEqual(
    r.sources.map(x => x.provenance),
    ["R", "R"]
  );
  assert.equal(r.holes.R, 1);
  assert.equal(r.jsx.R, 1);
});
test("S: constant server argument is the zero-U-input case", () => {
  const r = analyze(
    `${memo('"a"')} return view(function*(){return <h1>{yield* article.title}</h1>});`
  );
  assert.equal(r.sources[0].provenance, "S");
});
test("C: event-written serializable input never becomes R", () => {
  const r = analyze(
    `const [slug,set]=yield* $signal("a");const change=$event(function*(){yield* set("b")}); ${memo("yield* slug")} return view(function*(){return <button onClick={yield* change}>{yield* article.title}</button>});`
  );
  assert.equal(r.sources[0].provenance, "C");
  assert.equal(r.holes.R, 0);
});
test("U: an unrelated pre-attempt read is not smuggled across the cut", () => {
  const r = analyze(
    `const other=foreignSource(()=>"x"); const article=yield* $memo(function*(){const unused=yield* other;return yield* attempt(()=>load("a"),e=>new Missing(e));}); return view(function*(){return <h1>{yield* article.title}</h1>});`
  );
  assert.equal(r.sources[0].provenance, "U");
});
test("capture: function inputs are refused despite a typed scalar target", () => {
  const r = analyze(
    `${memo('()=>"a"')} return view(function*(){return <h1>{yield* article.title}</h1>});`
  );
  assert.equal(r.captures.length, 1);
  assert.equal(r.serverCalls[0].captureEligible, false);
  assert.equal(r.sources[0].provenance, "U");
});
test("R: typed error accessor remains with server boundary, reset stays client", () => {
  for (const reset of [false, true]) {
    const r = analyze(
      `const slug=foreignSource(()=>"a"); ${memo("yield* slug")} return view(function*(){return <>{yield* Errored({catch:[Missing],fallback:(err,reset)=>${reset ? "<button onClick={reset}>{err().message}</button>" : "<p>{err().message}</p>"},children:function*(){return <>{yield* Loading({fallback:"pending",children:function*(){return <h1>{yield* article.title}</h1>}})}</>}})}</>});`
    );
    assert.equal(r.sources[0].provenance, "R");
    if (!reset) assert.equal(r.holes.client, 0);
    else assert(r.holes.client > 0);
  }
});

test("opaque pipeline calls remain unknown without an explicit purity contract", () => {
  const r = analyze(
    `const slug=foreignSource(()=>"a"); ${memo("yield* slug")} const html=yield* $memo(function*(){return opaque(yield* article);}); return view(function*(){return <div innerHTML={yield* html}/>;});`
  );
  assert.equal(r.sources.at(-1).provenance, "U");
});

test("use pure trusts exported derivations, preserves S/R/U/C, and reports unused modules", () => {
  for (const [input, expected] of [
    ['"a"', "S"],
    ["yield* article", "R"],
    ["yield* slug", "U"],
    ["yield* n", "C"]
  ]) {
    for (const directive of [true, false]) {
      const r = analyzeRecomputable(
        new Map([
          [
            "/pipeline.ts",
            `${directive ? '"use pure";' : ""}
            import {render} from "opaque-package";
            export function derive(input) { return render(input); }
            // Source edits do not invalidate the author's assertion.`
          ],
          ["/unused.ts", '"use pure"; export const unused = x => x;'],
          [
            "/fixture.tsx",
            `import {component,view,$memo,$signal,$event,attempt,foreignSource} from "solid-yield";
            import {derive} from "./pipeline";
            async function load(slug:string){"use server";return slug;}
            const App=component(function*(){
              const slug=foreignSource(()=>"a");
              const [n,setN]=yield* $signal(0);
              const click=$event(function*(){yield* setN(1);});
              ${memo("yield* slug")}
              const html=yield* $memo(function*(){return derive(${input});});
              return view(function*(){return <><button onClick={yield* click}/><div innerHTML={yield* html}/></>;});
            });`
          ]
        ]),
        { resolve: spec => (spec === "./pipeline" ? "/pipeline.ts" : undefined) }
      );
      assert.equal(
        r.sources.at(-1).provenance,
        directive ? expected : expected === "C" ? "C" : "U"
      );
      assert.deepEqual(
        r.trustedPureModules.map(f => f.at),
        directive ? ["/pipeline.ts", "/unused.ts"] : ["/unused.ts"]
      );
      assert(r.trustedPureModules.every(f => f.reason.includes("implementation is not checked")));
      assert.equal(r.captures.length, 0);
    }
  }
});
