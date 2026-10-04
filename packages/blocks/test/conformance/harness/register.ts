/**
 * Test registration shared by the three environment specs. Every scenario ×
 * applicable mode becomes one vitest test; oracle modes are checked against
 * the scenario's golden trace, every other mode against its oracle's
 * observation under the declared expectation.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { judge } from "./compare.js";
import { mode as modeById, modesFor } from "./modes.js";
import type { Environment, ModeAdapter, ModeExpectation, Observation, Scenario } from "./types.js";

export function expectationFor(scenario: Scenario, mode: ModeAdapter): ModeExpectation {
  return scenario.modes?.[mode.id] ?? { status: "equivalent" };
}

/** Why (scenario, mode) is not run, or undefined when it is. */
export function exclusion(scenario: Scenario, mode: ModeAdapter): string | undefined {
  if (mode.environment !== "client" && !scenario.ssr) return "not applicable: client-only scenario";
  if (scenario.sources[mode.source] === undefined)
    return `not applicable: no ${mode.source} source`;
  const expectation = expectationFor(scenario, mode);
  if (expectation.status === "not-applicable") return `not applicable: ${expectation.reason}`;
  return undefined;
}

const goldenDir = resolve(dirname(fileURLToPath(import.meta.url)), "../golden");

/**
 * Oracle modes are pinned to a committed golden trace per scenario and
 * environment (`golden/<scenario>.<environment>.trace`, one event per line;
 * update intentionally with `vitest -u`). A golden change means ordinary
 * Solid semantics — or the scenario — changed, and is reviewed as such.
 */
async function golden(scenario: Scenario, environment: Environment, observation: Observation) {
  // A driver step that threw is a broken scenario, never a golden.
  expect(
    observation.trace.filter(line => line === "## aborted" || line.startsWith("uncaught ")),
    `${scenario.name}: the oracle run aborted`
  ).toEqual([]);
  await expect(observation.trace.join("\n") + "\n").toMatchFileSnapshot(
    resolve(goldenDir, `${scenario.name}.${environment}.trace`)
  );
}

export function registerEnvironment(
  environment: Environment,
  scenarios: Scenario[],
  observe: (scenario: Scenario, mode: ModeAdapter) => Promise<Observation>
): void {
  const modes = modesFor(environment);
  for (const scenario of scenarios) {
    if (modes.every(mode => exclusion(scenario, mode))) continue;
    describe(scenario.name, () => {
      const cache = new Map<string, Promise<Observation>>();
      const observed = (mode: ModeAdapter) => {
        let result = cache.get(mode.id);
        if (!result) cache.set(mode.id, (result = observe(scenario, mode)));
        return result;
      };
      for (const mode of modes) {
        if (exclusion(scenario, mode)) continue;
        const expectation = expectationFor(scenario, mode);
        const title =
          expectation.status === "equivalent" ? mode.id : `${mode.id} [${expectation.status}]`;
        test(title, async () => {
          const observation = await observed(mode);
          if (!mode.reference) {
            await golden(scenario, environment, observation);
            return;
          }
          const reference = await observed(modeById(mode.reference));
          const verdict = judge(expectation, reference.trace, observation.trace);
          // CONFORMANCE_DUMP=json: the candidate trace as JSON (for declaring a `differs`).
          if (!verdict.ok && process.env.CONFORMANCE_DUMP === "json") {
            process.stderr.write(
              `@@TRACE ${JSON.stringify({ scenario: scenario.name, mode: mode.id, trace: observation.trace })}\n`
            );
          }
          // CONFORMANCE_DUMP=1: both traces side by side on divergence.
          if (!verdict.ok && process.env.CONFORMANCE_DUMP === "1") {
            const rows = Math.max(reference.trace.length, observation.trace.length);
            const lines = [`--- ${scenario.name}: ${mode.reference} | ${mode.id}`];
            for (let i = 0; i < rows; i++) {
              const a = reference.trace[i] ?? "",
                b = observation.trace[i] ?? "";
              lines.push(`${a === b ? " " : "≠"} ${a.padEnd(48)} | ${b}`);
            }
            process.stderr.write(lines.join("\n") + "\n");
          }
          expect(verdict.ok, `${scenario.name} / ${mode.id}: ${verdict.message}`).toBe(true);
        });
      }
    });
  }
}
