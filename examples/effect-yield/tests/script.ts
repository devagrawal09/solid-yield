import { executedBytesCheckpoint } from "yield-example-harness";
// The interaction script shared by the behavior tests and the differential
// parity test: it drives whichever app is mounted in `#root`
// (examples/effect or this twin) and records the DOM after every step.
//
// Time is fake (timers, Date and performance: the log's timestamps, Effect's
// sleeps and schedules) and `Math.random` is scripted, so both apps see the
// same latencies and the same transient failures.

import { flush } from "solid-js";

export const START = new Date("2026-01-01T12:00:00Z");
let random = 0.9;
export const setRandom = (r: number) => (random = r);

export function install() {
  vi.useFakeTimers({ now: START });
  random = 0.9;
  vi.spyOn(Math, "random").mockImplementation(() => random);
  document.body.innerHTML = '<div id="root"></div>';
}

export function uninstall() {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
}

export const root = () => document.getElementById("root")!;
export const $ = <T extends Element = HTMLElement>(sel: string) => root().querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string) => [
  ...root().querySelectorAll<T>(sel)
];

export async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  flush();
}

export async function type(value: string) {
  const input = $<HTMLInputElement>('input[type="search"]')!;
  input.value = value;
  input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  await advance(0);
}

export async function click(el: Element | null | undefined) {
  if (!el) throw new Error("click: no element");
  (el as HTMLElement).click();
  await advance(0);
}

export const button = (text: string) =>
  $$<HTMLButtonElement>("button").find(b =>
    b.textContent!.replace(/\s+/g, " ").trim().startsWith(text)
  );

export const logLines = () =>
  $$(".log-panel li").map(
    li =>
      `${li.querySelector(".log-kind")!.textContent}: ${li.querySelector(".log-msg")!.textContent}`
  );

export const steps: [name: string, run: () => Promise<unknown> | unknown][] = [
  ["mount", () => advance(0)],
  // --- typeahead (read path) -------------------------------------------------
  ["type s", () => type("s")],
  ["type so before s lands (supersedes the s flight)", () => type("so")],
  ["so lands", () => advance(1000)],
  ["type sol (stale while revalidating)", () => type("sol")],
  ["halfway", () => advance(300)],
  ["sol lands", () => advance(1000)],
  ["type zzz", () => type("zzz")],
  ["zzz lands (no matches)", () => advance(1000)],
  ["clear the query", () => type("")],
  ["flaky network: every attempt fails", () => (setRandom(0.1), type("vite"))],
  ["retries back off", () => advance(1500)],
  ["retries give up", () => advance(4000)],
  ["network recovers, try again", () => (setRandom(0.9), click(button("Try again")))],
  ["vite lands", () => advance(1000)],
  ["clear the log", () => click(button("Clear"))],
  // --- checkout (action path) ------------------------------------------------
  ["open the checkout tab", () => click(button("Checkout"))],
  ["orders load", () => advance(400)],
  ["increment the first item", () => click($$(".cart-row")[0].querySelectorAll("button")[1])],
  ["decrement the second item", () => click($$(".cart-row")[1].querySelectorAll("button")[0])],
  ["place an order", () => click(button("Place order"))],
  ["reserving done, charging", () => advance(1000)],
  ["charging done, finalizing", () => advance(2600)],
  ["order created", () => advance(800)],
  ["orders refresh", () => advance(400)],
  [
    "tick decline",
    () => {
      const box = $<HTMLInputElement>(".decline-toggle input")!;
      box.checked = true;
      box.dispatchEvent(new InputEvent("input", { bubbles: true }));
      return advance(0);
    }
  ],
  ["place a declined order", () => click(button("Place order"))],
  ["charge declines", () => advance(3600)],
  ["compensations run", () => advance(1000)],
  [
    "untick decline",
    () => {
      const box = $<HTMLInputElement>(".decline-toggle input")!;
      box.checked = false;
      box.dispatchEvent(new InputEvent("input", { bubbles: true }));
      return advance(0);
    }
  ],
  ["place an order to cancel", () => click(button("Place order"))],
  ["mid-charge", () => advance(2000)],
  ["cancel", () => click(button("Cancel checkout"))],
  ["compensations after cancel", () => advance(1500)],
  ["back to the typeahead tab (fresh component)", () => click(button("Typeahead"))],
  ["settle", () => advance(1000)]
];

export async function runScript(): Promise<string[]> {
  const out: string[] = [];
  for (const [name, run] of steps) {
    await run();
    executedBytesCheckpoint(name);
    out.push(root().innerHTML);
  }
  return out;
}
