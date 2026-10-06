import { executedBytesCheckpoint } from "yield-example-harness";
// The interaction script shared by the behavior tests and the differential
// parity test: it mounts an App (examples/hackernews-spa's or this twin's)
// client-only in jsdom, with `fetch` answering the HN API from fixtures
// (tests/fixtures/hn-data.mjs; `~/lib/hn` runs in-process — see
// vitest.config.ts), and records the DOM after every step.
import { flush } from "solid-js";
import { createComponent, render } from "@solidjs/web";
import { normalize } from "yield-example-harness";
import { answer } from "./fixtures/hn-data.mjs";

export interface Mounted {
  root: HTMLElement;
  dispose(): void;
}

export function install(path: string) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return new Response(JSON.stringify(answer(url)), {
      headers: { "content-type": "application/json" }
    });
  });
  // jsdom has no scrolling; the router scrolls to the top on navigation.
  vi.stubGlobal("scrollTo", () => {});
  history.replaceState(null, "", path);
}

export function uninstall() {
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

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

/** Let fetches resolve and the graph settle (the fixtures answer in a few ticks). */
export async function settle() {
  for (let i = 0; i < 10; i++) {
    await tick();
    flush();
  }
}

export async function click(app: Mounted, selector: string) {
  const el = app.root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`no element matched ${selector}`);
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  await settle();
}

export type Step = [name: string, run: (app: Mounted) => Promise<unknown> | unknown];

export const steps: Step[] = [
  ["mount / (loading, then the top feed)", () => settle()],
  ["next page", app => click(app, 'a[aria-label="Next Page"]')],
  ["previous page", app => click(app, 'a[aria-label="Previous Page"]')],
  ["New", app => click(app, 'a[href="/new"]')],
  ["Ask", app => click(app, 'a[href="/ask"]')],
  ["Jobs", app => click(app, 'a[href="/job"]')],
  ["a job's story", app => click(app, 'a[href="/stories/job-3"]')],
  ["collapse the first thread", app => click(app, ".toggle a")],
  ["expand it", app => click(app, ".toggle a")],
  ["collapse the nested reply", app => click(app, ".comment .comment .toggle a")],
  ["a commenter", app => click(app, 'a[href="/users/alice"]')],
  ["Show", app => click(app, 'a[href="/show"]')],
  ["Show page 2 (last page)", app => click(app, 'a[aria-label="Next Page"]')],
  ["a story's author", app => click(app, 'a[href="/users/user1"]')],
  ["home", app => click(app, 'a[href="/"]')]
];

export async function runScript(app: Mounted): Promise<string[]> {
  const out: string[] = [];
  for (const [name, run] of steps) {
    await run(app);
    executedBytesCheckpoint(name);
    out.push(`${location.pathname}${location.search}\n${normalize(app.root.innerHTML)}`);
  }
  return out;
}
