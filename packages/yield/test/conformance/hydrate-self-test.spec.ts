/**
 * Harness self-tests (hydrate environment): a client build whose owner tree
 * differs from the server's — one extra owner before the markup, so every
 * hydration key below it shifts — must be rejected by the comparator (the
 * server markup is the unmutated scenario's pinned `server/library`
 * artifact); the library client cannot hydrate the compiler route's markup;
 * and a call-form fallback written as JSX misses a key (D-092; the mutant's
 * own server output, pinned by server.spec.ts).
 */
import { expect, test } from "vitest";
import * as solid from "solid-js";
import * as web from "@solidjs/web";
import * as lib from "solid-yield";
import { judge } from "./harness/compare.js";
import { mode } from "./harness/modes.js";
import { mutate } from "./harness/mutate.js";
import { expectationFor } from "./harness/register.js";
import { observeHydrate } from "./harness/runner.js";
import { readFileSync } from "node:fs";
import { compilerRouteFile, readArtifact } from "./harness/artifacts.js";
import { yieldRowKeyedStore, loadingFallbackHydration } from "./scenarios/index.js";
import { jsxFallback } from "./scenarios/mutants.js";

test("the comparator catches a hydration-ID mismatch", async () => {
  const runtime = { solid, web, lib };
  const scenario = yieldRowKeyedStore;
  const candidate = mode("hydrate/library");
  const expectation = expectationFor(scenario, candidate);
  const artifact = readArtifact(scenario.name, "server/library");
  const reference = await observeHydrate(
    scenario,
    mode("hydrate/reference"),
    runtime,
    readArtifact(scenario.name, "server/reference")
  );
  const clean = await observeHydrate(scenario, candidate, runtime, artifact);
  expect(judge(expectation, reference.trace, clean.trace).ok).toBe(true);

  // A client-only extra owner ahead of the markup: the client's keys no
  // longer line up with the server's.
  const mutant = mutate(scenario, [
    [
      "  return view(function* () {\n    return (\n      <ul>",
      "  yield* $memo(function* () {\n    return 0;\n  });\n  return view(function* () {\n    return (\n      <ul>"
    ],
    ["import { $component, $event, $store,", "import { $component, $event, $memo, $store,"]
  ]);
  const observed = await observeHydrate(mutant, candidate, runtime, artifact);
  const verdict = judge(expectation, reference.trace, observed.trace);
  expect(verdict.ok).toBe(false);
  expect(verdict.comparison!.divergence!.step).toBe("hydrate");
  expect(verdict.comparison!.divergence!.actual).toMatch(/^console\.warn = Hydration key miss/);
});

test("the library route cannot hydrate the compiler route's markup (D-069 F6, pinned by D-074)", async () => {
  // The routes number hydration keys differently (routes.spec.ts): the
  // library client, given the compiler route's frozen server output, misses
  // every key, the root's included, and leaves the page inert.
  const runtime = { solid, web, lib };
  const scenario = yieldRowKeyedStore;
  const output = readFileSync(compilerRouteFile(scenario.name), "utf8").replace(/\n$/, "");
  const observed = await observeHydrate(scenario, mode("hydrate/library"), runtime, { output });
  const misses = observed.trace
    .filter(line => line.startsWith("console.warn = Hydration key miss"))
    .map(line => line.match(/miss for "([^"]+)"/)![1]);
  expect(misses).toEqual(["0", "1000", "1010", "1020"]);
  expect(observed.trace).toContain(
    "console.warn = Hydration completed with 4 unclaimed server-rendered node(s):"
  );
  // a click no longer updates the server markup
  const htmls = observed.trace.filter(line => line.startsWith("html = "));
  expect(new Set(htmls).size).toBe(1);
});

test("a call-form fallback written as JSX misses a hydration key the server never rendered (D-092)", async () => {
  // The scenario's fallback is a lazy view. Written as JSX it is an argument,
  // built in the holding view's hole on both sides, shown or not: the keys
  // stay aligned (the boundary is the hole's second child on both), but the
  // server renders the settled content in place, so the client's eager
  // fallback claims a key no server node carries — rendering-yield's streamed
  // /stream, /profile and /error-stream, room's /live and hackernews' story
  // did this until D-092. The server output is the mutant's own (pinned by
  // server.spec.ts).
  const runtime = { solid, web, lib };
  const scenario = loadingFallbackHydration;
  const candidate = mode("hydrate/library");
  const reference = await observeHydrate(
    scenario,
    mode("hydrate/reference"),
    runtime,
    readArtifact(scenario.name, "server/reference")
  );
  const clean = await observeHydrate(
    scenario,
    candidate,
    runtime,
    readArtifact(scenario.name, "server/library")
  );
  const expectation = expectationFor(scenario, candidate);
  expect(judge(expectation, reference.trace, clean.trace).ok).toBe(true);

  const observed = await observeHydrate(
    jsxFallback,
    candidate,
    runtime,
    readArtifact(jsxFallback.name, "server/library")
  );
  expect(judge(expectation, reference.trace, observed.trace).ok).toBe(false);
  const misses = observed.trace
    .filter(line => line.startsWith("console.warn = Hydration key miss"))
    .map(line =>
      line
        .match(/miss for "([^"]+)".*\(template: ([^)]*)\)/)!
        .slice(1)
        .join(" ")
    );
  // only the fallback: the content is claimed, and stays live
  expect(misses).toEqual(["10 <p class=loading>loading"]);
  expect(observed.trace).toContain("hydration server-nodes 2/2 kept, 0 client-inserted");
  expect(observed.trace).toContain(
    'html = <section _hk="0"><p _hk="11000" class="user">grace</p></section>'
  );
});
