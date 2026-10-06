/**
 * Harness self-tests: the oracle must catch real semantic regressions. Each
 * mutant is a real scenario with one planted bug in its library source,
 * compiled through the library route and run through the ordinary client
 * runner; the comparator must reject it and point at the right event. Also
 * pins the judge's expectation rules (a known defect that stops reproducing,
 * or a declared difference that is not a difference, fails).
 */
import { describe, expect, test } from "vitest";
import * as solid from "solid-js";
import * as web from "@solidjs/web";
import * as lib from "solid-yield";
import { judge } from "./harness/compare.js";
import { mode } from "./harness/modes.js";
import { mutate } from "./harness/mutate.js";
import { expectationFor } from "./harness/register.js";
import { observeClient } from "./harness/runner.js";
import type { Scenario } from "./harness/types.js";
import { asyncFlights, yieldCounter, yieldRowList } from "./scenarios/index.js";

const runtime = { solid, web, lib };

/** Judge a mutant under the original scenario's declared expectation. */
async function verdictFor(original: Scenario, mutant: Scenario) {
  const candidate = mode("client/library");
  const expectation = expectationFor(original, candidate);
  const reference = await observeClient(original, mode("client/reference"), runtime);
  // the unmutated source passes, so the planted bug is what gets caught
  const clean = await observeClient(original, candidate, runtime);
  expect(judge(expectation, reference.trace, clean.trace).ok).toBe(true);
  const observed = await observeClient(mutant, candidate, runtime);
  return judge(expectation, reference.trace, observed.trace);
}

describe("the comparator catches planted regressions", () => {
  test("missing cleanup", async () => {
    const mutant = mutate(yieldRowList, [
      ['            yield* $cleanup(() => h.run("cleanup " + label));\n', ""]
    ]);
    const verdict = await verdictFor(yieldRowList, mutant);
    expect(verdict.ok).toBe(false);
    expect(verdict.comparison!.divergence!.expected).toBe("run cleanup a");
    expect(verdict.comparison!.missing).toEqual([
      "run cleanup a",
      "run cleanup c",
      "run cleanup b"
    ]);
  });

  test("duplicate event write", async () => {
    const mutant = mutate(yieldCounter, [
      [
        "    yield* setCount((yield* count) + 1);\n",
        "    yield* setCount((yield* count) + 1);\n    yield* setCount((yield* count) + 1);\n"
      ]
    ]);
    const verdict = await verdictFor(yieldCounter, mutant);
    expect(verdict.ok).toBe(false);
    expect(verdict.comparison!.divergence!.step).toBe("click");
    expect(verdict.comparison!.kinds).toEqual(expect.arrayContaining(["write"]));
  });

  test("stale async commit (a superseded flight's result reaches the DOM)", async () => {
    // Commit every flight's result as it lands, through a plain Solid signal
    // (what `no-foreign-reactive` forbids) — the classic stale-response bug.
    const mutant = mutate(asyncFlights, [
      [
        "export let setId",
        'import { createSignal } from "solid-js";\nconst [shown, setShown] = createSignal<string>();\nexport let setId'
      ],
      [
        'const v = yield* attempt(() => h.task<string>("load", i), notFound);',
        'const v = yield* attempt(() => h.task<string>("load", i).then(r => (setShown(() => r), r)), notFound);'
      ],
      [
        'return <p class="user">{yield* user}</p>;',
        'return <p class="user">{(yield* user, shown())}</p>;'
      ]
    ]);
    const verdict = await verdictFor(asyncFlights, mutant);
    expect(verdict.ok).toBe(false);
    const d = verdict.comparison!.divergence!;
    expect(d.step).toBe("resolve stale load#2 (must not commit)");
    expect(d.expected).toBe('html = <p class="user">grace</p>');
    expect(d.actual).toBe('html = <p class="user">stale</p>');
  });

  test("owner mismatch", async () => {
    const mutant = mutate(asyncFlights, [
      [
        'h.where("before wait(" + i + ")");',
        'runWithOwner(null, () => h.where("before wait(" + i + ")"));'
      ],
      ["export let setId", 'import { runWithOwner } from "solid-js";\nexport let setId']
    ]);
    const verdict = await verdictFor(asyncFlights, mutant);
    expect(verdict.ok).toBe(false);
    expect(verdict.comparison!.divergence!.expected).toBe("owner before wait(1) = user memo");
    expect(verdict.comparison!.divergence!.actual).toBe("owner before wait(1) = none");
    expect(verdict.comparison!.kinds).toEqual(["owner"]);
  });
});

describe("expectation rules", () => {
  const reference = ["## mount", "run a", "value a = 1"];

  test("a known defect that no longer reproduces fails (flip it)", () => {
    const verdict = judge({ status: "known-defect", reason: "x" }, reference, reference);
    expect(verdict.ok).toBe(false);
    expect(verdict.message).toMatch(/no longer reproduces/);
  });

  test("a known defect pinned elsewhere fails", () => {
    const actual = ["## mount", "run a", "value a = 2"];
    expect(
      judge(
        { status: "known-defect", reason: "x", firstDivergence: "value a = 2" },
        reference,
        actual
      ).ok
    ).toBe(true);
    expect(
      judge({ status: "known-defect", reason: "x", firstDivergence: "run b" }, reference, actual).ok
    ).toBe(false);
  });

  test("a declared difference must actually differ and be reproduced exactly", () => {
    expect(
      judge({ status: "differs", reason: "x", trace: reference }, reference, reference).ok
    ).toBe(false);
    const declared = { status: "differs" as const, reason: "x", remove: ["value a = 1"] };
    expect(judge(declared, reference, ["## mount", "run a"]).ok).toBe(true);
    expect(judge(declared, reference, ["## mount", "run a", "run a"]).ok).toBe(false);
    expect(
      judge({ status: "differs", reason: "x", remove: ["nope"] }, reference, reference).ok
    ).toBe(false);
  });

  test("equivalence is exact: order and multiplicity matter", () => {
    expect(
      judge({ status: "equivalent" }, reference, ["## mount", "value a = 1", "run a"]).ok
    ).toBe(false);
    expect(judge({ status: "equivalent" }, reference, [...reference, "run a"]).ok).toBe(false);
  });
});
