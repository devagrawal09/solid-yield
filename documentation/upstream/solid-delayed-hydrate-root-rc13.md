# [2.0.0-rc.13] A second hydrate() root after a timer turn replaces its server-rendered nodes instead of claiming them

## Summary

Two independent `Hydration` scopes with IDs `a` and `b` contain counter buttons, with a `NoHydration` heading between them. Calling `hydrate()` for both roots synchronously keeps both server-rendered buttons. Hydrating A, waiting for one `setTimeout(0)`, then hydrating B replaces B's button. The old B node is disconnected, although the final page looks correct. Neither schedule produces a warning, including with the development build.

## Reproduction

Save as `repro.mjs`; the server uses `renderToString()` and the client uses matching `renderId` values. Each schedule runs in a fresh process.

```js
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const mode = process.argv[2];
const run = args => {
  const result = spawnSync(process.execPath, args, { input: html, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};
let html;
if (!mode) {
  html = run([import.meta.filename, "server"]);
  for (const schedule of ["synchronous", "delayed"])
    process.stdout.write(run(["--conditions=browser", import.meta.filename, schedule]));
} else if (mode === "server") {
  const { Hydration, NoHydration, createSignal } = await import("solid-js");
  const { renderToString, HydrationScript, ssrElement } = await import("@solidjs/web");
  const Counter = () => {
    const [count] = createSignal(0);
    return ssrElement("button", {}, count(), true);
  };
  const scope = id => ssrElement("section", { id }, () =>
    Hydration({ id, get children() { return Counter(); } }), false);
  console.log(renderToString(() => [HydrationScript({}), NoHydration({
    get children() { return [scope("a"), ssrElement("h1", {}, "Heading", false), scope("b")]; }
  })], { renderId: "outer" }));
} else {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><body></body>");
  for (const key of ["window", "document", "Node", "Element", "HTMLElement"])
    globalThis[key] = dom.window[key];
  html = readFileSync(0, "utf8");
  const scripts = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
  document.body.innerHTML = html.replace(scripts, "");
  for (const match of html.matchAll(scripts)) (0, eval)(match[1]);
  const { createSignal } = await import("solid-js");
  const { hydrate, template, getNextElement, insert } = await import("@solidjs/web");
  const button = template("<button></button>");
  const Counter = () => {
    const [count, setCount] = createSignal(0);
    const node = getNextElement(button);
    node.onclick = () => setCount(n => n + 1);
    insert(node, count);
    return node;
  };
  const A = Counter, B = Counter;
  const elA = document.getElementById("a"), elB = document.getElementById("b");
  const oldA = elA.firstChild, oldB = elB.firstChild, warnings = [];
  console.warn = (...args) => warnings.push(args.join(" "));
  hydrate(A, elA, { renderId: "a" });
  if (mode === "delayed") await new Promise(r => setTimeout(r, 0));
  hydrate(B, elB, { renderId: "b" });
  console.log(`${mode}: A claimed=${elA.firstChild === oldA}; B claimed=${elB.firstChild === oldB}; old B connected=${oldB.isConnected}; warnings=${warnings.length}`);
  assert.equal(elA.firstChild, oldA);
  assert.equal(elB.firstChild === oldB, mode === "synchronous");
  assert.equal(oldB.isConnected, mode === "synchronous");
  assert.deepEqual(warnings, []);
  dom.window.close();
}
```

```sh
npm install solid-js@2.0.0-rc.13 @solidjs/web@2.0.0-rc.13 jsdom@25.0.1
node repro.mjs
```

## Expected vs Actual

| Schedule | Expected | Actual |
| --- | --- | --- |
| Synchronous | Both server buttons claimed | Both claimed; no warning |
| Delayed by one timer turn | Both server buttons claimed | Second replaced; old node disconnected; no warning |

## Cause

After the first hydration completes, `drainHydrationCallbacks` schedules the page-wide `_$HY.done = true` (`node_modules/solid-js/dist/solid.js:91–104`; development: `dist/solid.dev.js:125–139`). Web's `hydrate` then takes its plain-render path for any later root (`node_modules/@solidjs/web/dist/web.js:1353–1356`; development: `dist/web.dev.js:1521–1524`).

## Proposal

Track completion per hydration scope / `renderId`, or have `hydrate(..., { renderId })` avoid consulting the global completion flag.

## Versions

`solid-js`: 2.0.0-rc.13; `@solidjs/web`: 2.0.0-rc.13; jsdom: 25.0.1; Node: v24.18.0.
