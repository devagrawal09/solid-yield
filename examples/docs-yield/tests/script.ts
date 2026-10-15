import { flush } from "solid-js";
import { normalize, executedBytesCheckpoint, type Step } from "yield-example-harness";
export const root = () => document.getElementById("root")!;
const $ = <T extends Element = HTMLElement>(selector: string) => root().querySelector<T>(selector)!;
const measuringBytes = () =>
  typeof (globalThis as { __yieldExecutedBytes?: unknown }).__yieldExecutedBytes === "function";
let heldAvatars: (() => void)[] = [];
export function install() {
  vi.useFakeTimers();
  if (measuringBytes()) {
    // Keep the fake API's avatar promises pending until their named settled step.
    // No elapsed time or queued work can resolve them during the fallback snapshot.
    const timeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      ...[callback, ms, ...args]: Parameters<typeof setTimeout>
    ) => {
      if (ms !== 180) return timeout(callback, ms, ...args);
      heldAvatars.push(() => callback(...args));
      return 0;
    }) as typeof setTimeout);
  }
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  history.replaceState(null, "", "/");
  document.body.innerHTML = '<div id="root"></div>';
}
export function uninstall() {
  heldAvatars = [];
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
}
const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  flush();
};
const click = (selector: string) => {
  $(selector).dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
  );
  flush();
};
const input = (selector: string, value: string) => {
  const el = $<HTMLInputElement>(selector);
  el.value = value;
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  flush();
};
const submit = () => {
  $(".newsletter").dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
  flush();
};
export const steps: Step[] = [
  ["load / (pending)", () => flush()],
  ["content loads", () => advance(70)],
  ["comment list loads, avatars pending", () => advance(60)],
  [
    "avatars load",
    () => {
      for (const resolve of heldAvatars.splice(0)) resolve();
      return advance(200);
    }
  ],
  ["navigate to /docs/start", () => click('nav a[href="/docs/start"]')],
  ["article loads", () => advance(100)],
  ["toggle theme", () => click(".theme button")],
  ["search starts", () => input(".search input", "local")],
  ["search results", () => advance(100)],
  ["like (optimistic)", () => click(".like button")],
  ["like saved", () => advance(100)],
  ["second like (optimistic)", () => click(".like button")],
  ["like rate limited", () => advance(100)],
  ["newsletter good email", () => input(".newsletter input", "reader@example.com")],
  ["newsletter in flight", submit],
  ["newsletter success", () => advance(100)],
  ["newsletter bad email", () => input(".newsletter input", "bad")],
  ["bad newsletter in flight", submit],
  ["newsletter typed error", () => advance(100)],
  ["carousel next", () => click(".carousel button")],
  ["search failure starts", () => input(".search input", "fail")],
  ["search typed error", () => advance(100)],
  ["navigate to failing slug", () => click('nav a[href="/docs/missing"]')],
  ["not-found typed error", () => advance(100)]
];
export async function runScript() {
  const out: string[] = [];
  for (const [name, run] of steps) {
    await run();
    if (measuringBytes()) {
      // Finish the first paint and queued continuations without advancing API time.
      await advance(0);
      if (name === "comment list loads, avatars pending" && !$(".avatar-pending"))
        throw new Error("executed bytes: avatar fallback must paint before resolution");
    }
    executedBytesCheckpoint(name);
    out.push(normalize(root().innerHTML));
  }
  return out;
}
