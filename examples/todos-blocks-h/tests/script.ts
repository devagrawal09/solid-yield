// The interaction script shared by the behavior tests and the differential
// parity test: it drives whichever TodoMVC is mounted in `#root`
// (examples/todos or a twin) and records the DOM after every step.
//
// The mock API delays every call 400 ms and fails a save when
// `Math.random() < 0.33`: time is fake and `Math.random` is scripted, so
// both apps see the same latencies and the same failures.
import { flush } from "solid-js";
import { normalize } from "blocks-example-harness";

export const SEED = [
  { id: "1700000000000-a", title: "write blocks", completed: false },
  { id: "1700000000001-b", title: "ship blocks", completed: true }
];

let random = 0.9;
export const setRandom = (r: number) => (random = r);

export function install() {
  vi.useFakeTimers({ now: new Date("2026-01-01T12:00:00Z") });
  random = 0.9;
  vi.spyOn(Math, "random").mockImplementation(() => random);
  localStorage.setItem("TODOS", JSON.stringify(SEED));
  location.hash = "";
  document.body.innerHTML = '<div id="root"></div>';
}

export function uninstall() {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  location.hash = "";
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
/** A write is a 400 ms save followed by a 400 ms re-fetch (`refresh`). */
export const settle = () => advance(1000);

export function type(title: string) {
  const input = $<HTMLInputElement>(".new-todo")!;
  input.value = title;
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  flush();
}
export function toggle(index: number) {
  const box = $$<HTMLInputElement>("li.todo .toggle")[index];
  box.checked = !box.checked;
  box.dispatchEvent(new InputEvent("input", { bubbles: true }));
  flush();
}
export function click(el: Element | null | undefined) {
  if (!el) throw new Error("click: no element");
  (el as HTMLElement).click();
  flush();
}
export function hash(value: string) {
  location.hash = value;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  flush();
}
export function toggleAll() {
  const box = $<HTMLInputElement>("#toggle-all")!;
  box.checked = !box.checked;
  box.dispatchEvent(new Event("change", { bubbles: true }));
  flush();
}

export const titles = () => $$("li.todo label").map(l => l.textContent);
export const count = () => $(".todo-count")?.textContent?.replace(/\s+/g, " ");

export const steps: [name: string, run: () => unknown][] = [
  ["mount (loading)", () => flush()],
  ["todos load", () => advance(500)],
  ["add a todo (optimistic)", () => type("write the linker")],
  ["add settles", () => settle()],
  ["toggle the first", () => toggle(0)],
  ["toggle settles", () => settle()],
  ["filter: active", () => hash("#/active")],
  ["filter: completed", () => hash("#/completed")],
  ["filter: all", () => hash("#/")],
  ["toggle all", () => toggleAll()],
  ["toggle all settles", () => settle()],
  ["toggle all back", () => toggleAll()],
  ["toggle all back settles", () => settle()],
  ["failing save: toggle the second", () => (setRandom(0.1), toggle(1))],
  ["the failure shows a retry", () => settle()],
  ["retry succeeds", () => (setRandom(0.9), click($("button.retry")))],
  ["retry settles", () => settle()],
  ["failing add", () => (setRandom(0.1), type("doomed"))],
  ["failed add stays with an error", () => settle()],
  ["retry the add", () => (setRandom(0.9), click($$("button.retry").at(-1)))],
  ["retried add settles", () => settle()],
  ["complete the first", () => toggle(0)],
  ["complete settles", () => settle()],
  ["clear completed", () => click($("button.clear-completed"))],
  ["clear settles", () => settle()],
  ["remove the first", () => click($("button.destroy"))],
  ["remove settles", () => settle()]
];

export async function runScript(): Promise<string[]> {
  const out: string[] = [];
  for (const [, run] of steps) {
    await run();
    out.push(normalize(root().innerHTML));
  }
  return out;
}
