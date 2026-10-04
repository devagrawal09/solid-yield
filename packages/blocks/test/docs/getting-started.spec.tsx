// documentation/getting-started.md's program runs as the guide says it does.
import { flush } from "solid-js";
import { render } from "solid-blocks";
import { App } from "./getting-started.js";

const settle = async () => {
  await new Promise(r => setTimeout(r, 20));
  flush();
  await new Promise(r => setTimeout(r, 0));
  flush();
};

let root: HTMLDivElement;
let dispose: (() => void) | undefined;
beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});
afterEach(() => {
  dispose?.();
  root.remove();
});

it("counts, loads a user, shows the hint, and shows the typed failure", async () => {
  dispose = render(App, root);
  flush();
  const $ = (s: string) => root.querySelector<HTMLElement>(s);
  expect($(".counter")!.textContent).toBe("0");
  expect(root.textContent).toContain("loading…");
  await settle();
  expect($(".user")!.textContent).toBe("Ada");
  expect($(".hint")).toBe(null);

  $(".counter")!.click();
  flush();
  expect($(".counter")!.textContent).toBe("2");

  $(".next")!.click();
  flush();
  await settle();
  expect($(".user")!.textContent).toBe("Grace");
  expect($(".hint")!.textContent).toBe("not the first user");

  $(".next")!.click();
  flush();
  await settle();
  expect($(".error")!.textContent).toBe("Error: no user 3");
});

it("disables the save button while the save is in flight (D-075)", async () => {
  dispose = render(App, root);
  flush();
  const save = root.querySelector<HTMLButtonElement>(".save")!;
  expect(save.textContent).toBe("saved 0");
  expect(save.disabled).toBe(false);
  save.click();
  await new Promise(r => setTimeout(r, 0));
  flush();
  expect(save.disabled).toBe(true);
  await settle();
  expect(save.disabled).toBe(false);
  expect(save.textContent).toBe("saved 1");
});
