// The interaction script shared by the behavior tests and the differential
// parity test: it drives whichever app is mounted in `document.body`
// (examples/sierpinski or this twin) and records the DOM after every step.
import { flush } from "solid-js";

export const START = new Date("2026-01-01T00:00:00Z");

/** Fake the clocks the app uses; `requestIdleCallback` is missing in jsdom. */
export function installClocks() {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "Date"
    ],
    now: START
  });
  (globalThis as any).requestIdleCallback = (cb: () => void) => setTimeout(cb, 1);
  (globalThis as any).cancelIdleCallback = (id: number) => clearTimeout(id);
}

export function uninstallClocks() {
  vi.clearAllTimers();
  vi.useRealTimers();
  delete (globalThis as any).requestIdleCallback;
  delete (globalThis as any).cancelIdleCallback;
}

/** The DOM of the app, normalized: nothing to strip for a CSR app. */
export function snapshot(): string {
  return document.body.innerHTML;
}

export const dots = () => [...document.body.querySelectorAll<HTMLElement>(".dot")];

export async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  flush();
}

function mouse(el: Element, type: "mouseenter" | "mouseleave") {
  el.dispatchEvent(new MouseEvent(type, { bubbles: false }));
  flush();
}

/** Steps: each returns nothing; the runner snapshots after each one. */
export const steps: [name: string, run: () => Promise<void> | void][] = [
  ["mount", () => flush()],
  // Every branch memo waits for one idle callback (1 ms each, nested 6 deep).
  ["idle callbacks resolve", () => advance(20)],
  ["one second: seconds = 1, frames scale the container", () => advance(1000)],
  ["idle callbacks for the new seconds", () => advance(20)],
  ["hover the first dot", () => mouse(dots()[0], "mouseenter")],
  ["hover the last dot", () => mouse(dots()[dots().length - 1], "mouseenter")],
  ["leave the first dot", () => mouse(dots()[0], "mouseleave")],
  ["four more seconds", () => advance(4000)],
  ["settle", () => advance(50)],
  ["eight more seconds (seconds wrap past 10)", () => advance(8000)],
  ["settle again", () => advance(50)]
];

export async function runScript(): Promise<string[]> {
  const out: string[] = [];
  for (const [, run] of steps) {
    await run();
    out.push(snapshot());
  }
  return out;
}
