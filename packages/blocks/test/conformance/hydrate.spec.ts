/**
 * Semantic conformance — hydrate environment. Applies each server mode's
 * pinned output (__artifacts__/, written by server.spec.ts), hydrates the
 * same component compiled for the client, checks node identity, then drives
 * the scenario's steps. See README.md.
 */
import * as solid from "solid-js";
import * as web from "@solidjs/web";
import * as blocks from "solid-blocks";
import { readArtifact } from "./harness/artifacts.js";
import { registerEnvironment } from "./harness/register.js";
import { observeHydrate } from "./harness/runner.js";
import { scenarios } from "./scenarios/index.js";

registerEnvironment("hydrate", scenarios, (scenario, mode) =>
  observeHydrate(
    scenario,
    mode,
    { solid, web, blocks },
    readArtifact(scenario.name, mode.pairedWith!)
  )
);
