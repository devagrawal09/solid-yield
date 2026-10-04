/**
 * Shared by the `-blocks` twins' tests.
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
