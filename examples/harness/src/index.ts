/**
 * Shared by the `-yield` twins' tests.
 *
 * `normalize` strips only what hydration adds (keys, markers); `parity`
 * runs one script against the original and the twin, snapshotting after
 * every step, and returns both lists for the test to compare.
 */

/** Strip hydration keys and markers: the only normalization parity allows. */
export function normalize(html: string): string {
  return html
    .replace(/\s(data-hk|_hk)="[^"]*"/g, "")
    .replace(/\s_hk=[^\s>]*/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

export type Step = [name: string, run: () => unknown | Promise<unknown>];

/**
 * Run `steps` after `mount()`, snapshotting `snapshot()` after each one.
 * `cleanup()` runs at the end (dispose, clear timers).
 */
export async function record(
  mount: () => unknown | Promise<unknown>,
  steps: Step[],
  snapshot: () => string = () => normalize(document.body.innerHTML),
  cleanup?: () => unknown | Promise<unknown>
): Promise<string[]> {
  const out: string[] = [];
  await mount();
  try {
    for (const [, run] of steps) {
      await run();
      out.push(snapshot());
    }
  } finally {
    await cleanup?.();
  }
  return out;
}

/** The first difference between two snapshot lists, for a readable failure. */
export function firstDifference(steps: Step[], a: string[], b: string[]): string | null {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    let at = 0;
    while (a[i] && at < a[i].length && a[i][at] === b[i]?.[at]) at++;
    return `step ${i} (${steps[i]?.[0]}): differs at ${at}\n  original: …${a[i]?.slice(Math.max(0, at - 80), at + 120)}\n  twin:     …${b[i]?.slice(Math.max(0, at - 80), at + 120)}`;
  }
  return null;
}

/**
 * Runtime cost (D-017; yield-library.md §8). A twin's `tests/runtime-cost.bench.ts(x)` runs
 * its parity script against one app per process — `YIELD_COST_APP` is `original` or `twin` —
 * and times phases with `timed`, which appends `{ app, phase, ms }` to `YIELD_COST_OUT`.
 * `examples/harness/runtime-cost/twins.mjs` drives it; the gate never runs it.
 */
// the twins type-check without Node's types: the environment and fs are reached untyped
const env = (): Record<string, string | undefined> =>
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
/** Whether twins.mjs is running this process (a cost test is skipped otherwise). */
export const costMode = env().YIELD_COST_APP !== undefined;
export function costApp(): "original" | "twin" {
  const app = env().YIELD_COST_APP;
  if (app !== "original" && app !== "twin")
    throw new Error("runtime cost: set YIELD_COST_APP to original or twin (run twins.mjs)");
  return app;
}
// captured at import, before a script installs fake timers
const clock = performance.now.bind(performance);
export async function timed<T>(phase: string, run: () => T | Promise<T>): Promise<T> {
  const t0 = clock();
  const out = await run();
  const ms = clock() - t0;
  const file = env().YIELD_COST_OUT;
  if (file) {
    const fs = (await import(/* @vite-ignore */ "node:" + "fs")) as {
      appendFileSync(path: string, data: string): void;
    };
    fs.appendFileSync(file, JSON.stringify({ app: costApp(), phase, ms }) + "\n");
  }
  return out;
}

/** Optional synchronous V8 checkpoint; absent in ordinary parity runs. */
export function executedBytesCheckpoint(phase: string): void {
  (globalThis as { __yieldExecutedBytes?: (phase: string) => void }).__yieldExecutedBytes?.(phase);
}
