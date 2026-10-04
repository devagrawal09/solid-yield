// TodoMVC with @solidjs/blocks in the no-JSX flavor (views built with h),
// driven through jsdom: loading, adding, toggling, filtering by hash, toggle
// all, clear completed, removing, per-item failures with retry, disposal.
import { render } from "@solidjs/blocks";
import { App } from "../src/app";
import {
  $,
  $$,
  advance,
  click,
  count,
  hash,
  install,
  root,
  setRandom,
  settle,
  titles,
  toggle,
  toggleAll,
  type,
  uninstall
} from "./script";

let dispose: () => void;
beforeEach(async () => {
  install();
  dispose = render(App, root());
  await advance(0);
});
afterEach(() => {
  dispose();
  uninstall();
});

it("shows the loading fallback, then the stored todos", async () => {
  expect(root().textContent).toContain("Loading…");
  await advance(500);
  expect(titles()).toEqual(["write blocks", "ship blocks"]);
  expect(count()).toBe("1 item left");
  expect($("li.todo:nth-child(2)")!.className).toBe("todo completed");
});

it("adds a todo optimistically (pending) and keeps it after the save", async () => {
  await advance(500);
  type("write the linker");
  expect(titles()).toEqual(["write blocks", "ship blocks", "write the linker"]);
  expect($$("li.todo")[2].classList.contains("pending")).toBe(true);
  expect($<HTMLInputElement>(".new-todo")!.value).toBe("");
  await settle();
  expect($$("li.todo")[2].classList.contains("pending")).toBe(false);
  expect(count()).toBe("2 items left");
  expect(JSON.parse(localStorage.getItem("TODOS")!)).toHaveLength(3);
});

it("toggles a todo and filters by the URL hash", async () => {
  await advance(500);
  toggle(0);
  await settle();
  expect(count()).toBe("0 items left");
  toggle(0);
  await settle();
  hash("#/active");
  expect(titles()).toEqual(["write blocks"]);
  expect($('a[href="#/active"]')!.className).toBe("selected");
  hash("#/completed");
  expect(titles()).toEqual(["ship blocks"]);
  hash("#/");
  expect(titles()).toEqual(["write blocks", "ship blocks"]);
});

it("toggles all, clears completed and removes", async () => {
  await advance(500);
  toggleAll();
  await settle();
  expect(count()).toBe("0 items left");
  expect($<HTMLInputElement>("#toggle-all")!.checked).toBe(true);
  click($("button.clear-completed"));
  await settle();
  expect(titles()).toEqual([]);
  expect($(".main")).toBe(null);
  expect($(".footer")).toBe(null);
  type("again");
  await settle();
  click($("button.destroy"));
  await settle();
  expect(titles()).toEqual([]);
});

it("marks a failed save with a retry affordance, and retries it", async () => {
  await advance(500);
  setRandom(0.1);
  toggle(1);
  await settle();
  expect($$("li.todo")[1].classList.contains("errored")).toBe(true);
  expect($("button.retry")!.getAttribute("title")).toBe("Retry toggleTodo");
  setRandom(0.9);
  click($("button.retry"));
  await settle();
  expect($("button.retry")).toBe(null);
  expect(count()).toBe("2 items left");
});

it("keeps a failed add in the list with its error", async () => {
  await advance(500);
  setRandom(0.1);
  type("doomed");
  await settle();
  expect(titles()).toContain("doomed");
  expect($("button.retry")!.getAttribute("title")).toBe("Retry addTodo");
});

it("disposes cleanly", async () => {
  await advance(500);
  dispose();
  dispose = () => {};
  expect(root().innerHTML).toBe("");
  hash("#/active");
  await advance(2000);
  expect(root().innerHTML).toBe("");
});
