import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { analyzeExample, markdown } from "../src/report.js";

const modules = new Map([
  [
    "/fixture.tsx",
    `import {component,view,$signal,$event,$memo,attempt,foreignSource} from "solid-yield";
    async function load(slug:string){"use server";return slug;}
    const App=component(function*(){
      const [n,setN]=yield* $signal(0);
      const click=$event(function*(){yield* setN(1);});
      const slug=foreignSource(()=>"start");
      const article=yield* $memo(function*(){const key=yield* slug;return yield* attempt(()=>load(key),e=>e);});
      return view(function*(){return <><button onClick={yield* click}>{yield* n}</button><h1>{yield* article}</h1></>;});
    });`
  ]
]);

test("report keeps C1 groups, directed event reach and R inputs separate", () => {
  const r = { twin: "fixture", ...analyzeExample(modules) };
  assert(r.placement.roots.length > 0);
  const event = r.reach.events.find(e => e.name.includes("click"));
  assert.equal(event.bound, true);
  assert(event.writes.some(p => p.name.includes("n@")));
  assert(!event.reached.some(p => p.name.includes("article@")));
  assert(r.provenance.holes.R > 0);
  assert(r.provenance.serverCalls.every(call => call.captureEligible));
  const copy = JSON.parse(JSON.stringify(r));
  assert.deepEqual(copy, r);
  const text = markdown([r]);
  assert(text.includes("C1b:"));
  assert(text.includes("| holes |"));
  assert(text.includes("runtime codec check required"));
});

test("CLI rejects an unknown example instead of reporting success with no graphs", () => {
  const r = spawnSync(process.execPath, ["packages/compiler-yield/src/report.js", "missing"], {
    cwd: new URL("../../..", import.meta.url),
    encoding: "utf8"
  });
  assert.equal(r.status, 2);
  assert(r.stderr.includes("Usage:"));
});
