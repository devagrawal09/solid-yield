/**
 * Semantic conformance — client environment (fresh render). Runs every
 * scenario through the client modes (handwritten reference, the library
 * route) and compares traces. See README.md.
 */
import * as solid from "solid-js";
import * as web from "@solidjs/web";
import * as blocks from "solid-blocks";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { coverageMatrix } from "./harness/matrix.js";
import { registerEnvironment } from "./harness/register.js";
import { observeClient } from "./harness/runner.js";
import { scenarios } from "./scenarios/index.js";

registerEnvironment("client", scenarios, (scenario, mode) =>
  observeClient(scenario, mode, { solid, web, blocks })
);

test("coverage matrix (COVERAGE.md) matches the registries", async () => {
  await expect(coverageMatrix(scenarios)).toMatchFileSnapshot(
    resolve(dirname(fileURLToPath(import.meta.url)), "COVERAGE.md")
  );
});
