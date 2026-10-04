// The interaction script shared by the behavior tests and the differential
// parity test: it mounts an App (examples/room's or this twin's) client-only
// in jsdom over the in-process fake wire (see vitest.config.ts), drives both
// pages, and records the DOM after every step.
//
// Time is fake and `Math.random` is seeded, so both apps mint the same
// identity and post the same message ids at the same instants.
import { flush } from "solid-js";
import { createComponent, render } from "@solidjs/web";
import { dropAll } from "./fake-server-functions";

export const START = new Date("2026-01-01T12:00:00Z");

export interface Mounted {
  root: HTMLElement;
  dispose(): void;
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function install(path = "/live?room=design") {
  vi.useFakeTimers({ now: START });
  vi.spyOn(Math, "random").mockImplementation(seeded(42));
  sessionStorage.clear();
  // jsdom has no scrolling; the router scrolls to the top on navigation.
  vi.stubGlobal("scrollTo", () => {});
  history.replaceState(null, "", path);
  // The chaos route: the fake wire's `dropAll` is what the dev server does.
  vi.stubGlobal("fetch", async (url: string) => {
    if (url !== "/__chaos/drop") return { ok: false, status: 404, text: async () => "" };
    const count = dropAll();
    return { ok: true, status: 200, text: async () => `dropped ${count}` };
  });
}

export function uninstall() {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
}

export function mount(App: (props: {}) => unknown): Mounted {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const dispose = render(() => createComponent(App as (props: {}) => Node, {}), root);
  flush();
  return { root, dispose: () => (dispose(), root.remove()) };
}

export async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  flush();
}

function $(app: Mounted, selector: string): HTMLElement {
  const el = app.root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`no ${selector} in ${app.root.innerHTML.slice(0, 400)}`);
  return el;
}

export async function type(app: Mounted, text: string) {
  const input = $(app, ".composer input") as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  await advance(0);
}

export async function submit(app: Mounted) {
  $(app, ".composer").dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
  await advance(0);
}

export async function click(app: Mounted, selector: string) {
  $(app, selector).click();
  await advance(0);
}

/** The input's value is a property, not markup: record it with the DOM. */
export function snapshot(app: Mounted): string {
  const input = app.root.querySelector<HTMLInputElement>(".composer input");
  return app.root.innerHTML + (input ? `\n[draft: ${input.value}]` : "");
}

export type Step = [name: string, run: (app: Mounted) => Promise<unknown> | unknown];

export const steps: Step[] = [
  // `/live`: the room from live data sources (the original's `/`, a live
  // server component, is not part of the twin: D-058)
  ["mount /live", () => advance(0)],
  ["shell sources land", () => advance(50)],
  ["the card's members land", () => advance(700)],
  ["the activity samples", () => advance(2000)],
  [
    "post on /live (optimistic, held for the echo)",
    async app => {
      await type(app, "live post");
      await submit(app);
    }
  ],
  ["the echo lands", () => advance(50)],
  ["the summary is streaming", () => advance(1600)],
  ["kill every connection (the summary dies)", app => click(app, ".chaos button")],
  ["live sources reconnect", () => advance(50)],
  ["regenerate the summary", app => click(app, ".error button")],
  ["the summary and the archive finish", () => advance(5000)],
  [
    "switch to #infra from the directory",
    app => click(app, '.directory a[href="/live?room=infra"]')
  ],
  ["#infra lands", () => advance(6000)]
];

export async function runScript(app: Mounted): Promise<string[]> {
  const out: string[] = [];
  for (const [, run] of steps) {
    await run(app);
    out.push(snapshot(app));
  }
  return out;
}
