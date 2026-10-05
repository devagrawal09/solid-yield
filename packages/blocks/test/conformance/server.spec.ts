/**
 * Semantic conformance — server environment (SSR). Stream-renders every
 * SSR scenario through each server mode, compares traces (markup, hydration
 * keys, serialized records, render-time reads / runs / tasks), and pins each
 * mode's complete output under __artifacts__/ for the hydrate environment.
 * See README.md.
 */
import * as solid from "solid-js";
import * as web from "@solidjs/web";
import * as blocks from "solid-blocks";
import { expect, test } from "vitest";
import { artifactFile } from "./harness/artifacts.js";
import { hydrationRecordKeys } from "./harness/records.js";
import { registerEnvironment } from "./harness/register.js";
import { mode } from "./harness/modes.js";
import { observeServer } from "./harness/runner.js";
import { scenarios } from "./scenarios/index.js";
import { jsxFallback } from "./scenarios/mutants.js";

registerEnvironment("server", scenarios, async (scenario, mode) => {
  const observation = await observeServer(
    scenario,
    mode,
    { solid, web, blocks },
    hydrationRecordKeys
  );
  await expect(observation.artifact.output + "\n").toMatchFileSnapshot(
    artifactFile(scenario.name, mode.id)
  );
  return observation;
});

test("self-test artifact: a call-form fallback written as JSX takes the hole's first key (D-092)", async () => {
  // Pinned for hydrate-self-test.spec.ts. The server builds the fallback (the
  // hole's child 0) and drops it: the content is settled, so it renders in
  // place, under a boundary that is now the hole's child 1.
  const observation = await observeServer(
    jsxFallback,
    mode("server/library"),
    { solid, web, blocks },
    hydrationRecordKeys
  );
  expect(observation.trace).toContain('hydration-keys = ["0","11000"]');
  await expect(observation.artifact.output + "\n").toMatchFileSnapshot(
    artifactFile(jsxFallback.name, "server/library")
  );
});
