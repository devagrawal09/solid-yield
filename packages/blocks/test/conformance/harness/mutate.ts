/**
 * Mutants for the harness self-tests: a copy of a scenario whose source has
 * an exact, verified edit. Every replacement must match exactly once, so a
 * self-test can never pass vacuously because its edit silently missed.
 */
import type { Scenario, SourceKind } from "./types.js";

export function mutate(
  scenario: Scenario,
  edits: [from: string, to: string][],
  source: SourceKind = "library"
): Scenario {
  let text = scenario.sources[source];
  if (text === undefined) throw new Error(`${scenario.name} has no ${source} source`);
  for (const [from, to] of edits) {
    const at = text.indexOf(from);
    if (at < 0 || text.indexOf(from, at + 1) >= 0) {
      throw new Error(`mutation of ${scenario.name} must match exactly once: ${from}`);
    }
    text = text.slice(0, at) + to + text.slice(at + from.length);
  }
  return {
    ...scenario,
    name: `${scenario.name}~mutant`,
    sources: { ...scenario.sources, [source]: text }
  };
}
