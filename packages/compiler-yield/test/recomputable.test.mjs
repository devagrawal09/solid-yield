import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRecomputable } from "../src/recomputable.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

test("C3c: use pure follows its input; removing the directive leaves the adapter opaque", () => {
  const file = resolve(import.meta.dirname, "../../../examples/docs-yield/src/article-pipeline.ts");
  const code = readFileSync(file, "utf8");
  for (const [input, expected] of [
    ["article", "R"],
    ["client", "C"],
    ["other", "U"]
  ]) {
    for (const changed of [false, true]) {
      const result = analyzeRecomputable(
        new Map([
          [
            file,
            changed
              ? code.replace('"use pure";', "")
              : code + "\n// edits do not invalidate the author assertion\n"
          ],
          [
            "/fixture.tsx",
            `
          import {component,view,$memo,$signal,$event,attempt,foreignSource} from "solid-yield";
          import {renderArticle} from "./article-pipeline";
          async function load(slug:string) {"use server";return {markdown:slug};}
          const App=component(function* App(){
            const slug=foreignSource(()=>"a");
            const other=foreignSource(()=>({markdown:"unknown"}));
            const [client,setClient]=yield* $signal({markdown:"client"});
            const change=$event(function*(){yield* setClient({markdown:"changed"});});
            const article=yield* $memo(function*(){const s=yield* slug;return yield* attempt(()=>load(s),e=>e);});
            const output=yield* $memo(function*(){return renderArticle(yield* ${input});});
            return view(function*(){return <div onClick={yield* change} innerHTML={(yield* output).html}/>;});
          });
        `
          ]
        ]),
        { entry: "/fixture.tsx", resolve: spec => (spec === "./article-pipeline" ? file : spec) }
      );
      assert.equal(result.sources.at(-1).provenance, changed && expected === "R" ? "U" : expected);
    }
  }
});
