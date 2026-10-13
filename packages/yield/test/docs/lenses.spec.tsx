import { flush } from "solid-js";
import { render } from "solid-yield";
import { Party, SlotGuests, SlotParty } from "./lenses.js";

let root: HTMLDivElement;
let dispose: (() => void) | undefined;
beforeEach(() => {
  root = document.createElement("div");
  document.body.append(root);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  root.remove();
});
const click = (sel: string) => {
  (root.querySelector(sel) as HTMLElement).click();
  flush();
};
const text = (sel: string) => root.querySelector(sel)!.textContent;

it("a lens prop: the module writes its part of the page's store", () => {
  dispose = render(Party, root);
  flush();
  expect(text(".free")).toBe("3");
  click(".kids");
  expect(text(".kids")).toBe("1");
  expect(text(".free")).toBe("2");
});
it("a slot bound by compose: the module writes the container; reset is one write", () => {
  dispose = render(SlotParty, root);
  flush();
  click(".kids");
  click(".kids");
  expect(text(".free")).toBe("1");
  click(".reset");
  expect(text(".kids")).toBe("0");
  expect(text(".free")).toBe("3");
});
it("a slot with init and no provider: the module uses a local store", () => {
  dispose = render(SlotGuests, root);
  flush();
  click(".kids");
  expect(text(".kids")).toBe("1");
});
