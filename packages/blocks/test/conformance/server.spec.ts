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
import { expect } from "vitest";
import { artifactFile } from "./harness/artifacts.js";
import { hydrationRecordKeys } from "./harness/records.js";
import { registerEnvironment } from "./harness/register.js";
import { observeServer } from "./harness/runner.js";
import { scenarios } from "./scenarios/index.js";

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
