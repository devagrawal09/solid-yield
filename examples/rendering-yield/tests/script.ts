// The interaction script shared by the behavior tests and the differential
// parity test: it mounts the shared App (examples/rendering's or this twin's)
// client-side in jsdom, as the CSR variant does, and records the DOM after
// every step. Timers are fake (the Home ticker, the simulated fetches, the
// stream); lazy route chunks are real dynamic imports, awaited by `until`.
import { flush } from "solid-js";
import { normalize } from "yield-example-harness";
import { createComponent, render } from "@solidjs/web";

// Captured before any test fakes the timers: real waits for dynamic imports.
const realSetTimeout = globalThis.setTimeout;

export interface Mounted {
  root: HTMLElement;
  dispose(): void;
}

export function install() {
  vi.useFakeTimers({
    now: new Date("2026-01-01T00:00:00Z"),
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"]
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  history.replaceState(null, "", "/");
  document.body.innerHTML = '<div id="app"></div>';
}

export function uninstall() {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
}

export function mount(App: (props: {}) => unknown): Mounted {
  const root = document.getElementById("app")!;
  const dispose = render(() => createComponent(App as (props: {}) => Node, {}), root);
  flush();
  return { root, dispose };
}

export async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  flush();
}

/** Real time for dynamic imports, fake time in 10 ms steps, until `cond`. */
export async function until(cond: () => boolean, what: string) {
  for (let i = 0; i < 2000; i++) {
    if (cond()) return;
    await new Promise(r => realSetTimeout(r, 5));
    if (i % 4 === 3) await advance(10);
    else flush();
  }
  throw new Error(
    `timed out waiting for ${what} (selected: ${selected()}, path: ${location.pathname}, onpopstate: ${typeof window.onpopstate})`
  );
}

const selected = () => document.querySelector("ul.inline li.selected a")?.textContent;

export async function nav(label: string) {
  const link = [...document.querySelectorAll<HTMLAnchorElement>("a.link")].find(
    a => a.textContent === label
  )!;
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  await until(() => selected() === label, `the ${label} tab`);
}

export function click(selector: string, text?: string) {
  const el = [...document.querySelectorAll<HTMLElement>(selector)].find(
    e => text === undefined || e.textContent === text
  );
  if (!el) throw new Error(`no ${selector} ${text ?? ""}`);
  el.click();
  flush();
}

export type Step = [name: string, run: () => Promise<unknown> | unknown];

export const steps: Step[] = [
  ["mount (Home, lazy)", () => until(() => !!document.querySelector("h1"), "Home")],
  ["Home ticks", () => advance(1000)],
  ["Profile", () => nav("Profile")],
  ["profile data", () => advance(900)],
  ["Settings", () => nav("Settings")],
  [
    "type",
    () => {
      const input = document.querySelector<HTMLInputElement>('input[type="text"]')!;
      input.value = "Hello yield";
      input.dispatchEvent(new InputEvent("input", { bubbles: true }));
      flush();
    }
  ],
  ["logical click inside the portal", () => click(".modal-card h2")],
  ["close the portal", () => click("button", "Close portal")],
  ["click the section (modal closed: not counted)", () => click("section h1")],
  ["reopen the portal", () => click("button", "Open body portal")],
  ["close again", () => click("button", "Close portal")],
  ["Stream", () => nav("Stream")],
  ["two items", () => advance(2100)],
  ["all items", () => advance(3200)],
  ["Error Stream", () => nav("Error Stream")],
  ["items settle / fail", () => advance(1600)],
  ["reset the inner bad item", async () => (click("button", "Reset to valid item"), advance(1600))],
  ["reset the outer bad item", async () => (click("button", "Reset to valid item"), advance(1600))],
  ["Reveal", () => nav("Reveal")],
  ["cards reveal (sequential)", () => advance(1800)],
  [
    "order: natural, restart",
    async () => {
      const radio = document.querySelector<HTMLInputElement>('input[value="natural"]')!;
      radio.checked = true;
      radio.dispatchEvent(new InputEvent("input", { bubbles: true }));
      click("button", "Restart run");
      await advance(600);
    }
  ],
  ["natural settles", () => advance(1200)],
  [
    "uncollapse (sequential)",
    async () => {
      const radio = document.querySelector<HTMLInputElement>('input[value="sequential"]')!;
      radio.checked = true;
      radio.dispatchEvent(new InputEvent("input", { bubbles: true }));
      const box = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      box.checked = false;
      box.dispatchEvent(new InputEvent("input", { bubbles: true }));
      click("button", "Restart run");
      await advance(800);
    }
  ],
  ["Skeleton", () => nav("Skeleton")],
  ["feed lands", () => advance(1300)],
  ["refetch (pending)", async () => (click("button", "Refetch"), advance(100))],
  ["refetched", () => advance(1300)],
  ["Home again", () => nav("Home")],
  [
    "popstate back",
    async () => {
      history.replaceState(null, "", "/settings");
      window.onpopstate!.call(window, new PopStateEvent("popstate"));
      await until(() => selected() === "Settings", "Settings via popstate");
    }
  ]
];

export async function runScript(app: Mounted): Promise<string[]> {
  const out: string[] = [];
  for (const [, run] of steps) {
    await run();
    // The portal renders into <body>, outside #app.
    // `createUniqueId()` values: a process-wide counter on the client (both
    // apps run in this one process), owner-tree based under SSR.
    out.push(normalize(document.body.innerHTML).replace(/ (for|id)="[0-9a-z-]+"/g, ' $1="#id"'));
  }
  void app;
  return out;
}
