// The booking page and its modules in jsdom, driven by DOM clicks only: an
// event is called where a view binds it (D-126, EVENT_OUTSIDE_RUN).
import { component, render, view } from "solid-yield";
import { BookingPage } from "../src/app";
import { DateRangePicker } from "../src/dateRange";
import { GuestCount } from "../src/guests";

let root: HTMLElement;
let dispose: (() => void) | undefined;
beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  root.remove();
});

const settle = () => new Promise<void>(r => setTimeout(r, 0));
const all = (s: string) => [...root.querySelectorAll(s)];
const texts = (s: string) => all(s).map(e => e.textContent);
async function click(s: string, i = 0) {
  (all(s)[i] as HTMLElement).click();
  await settle();
}
async function type(s: string, i: number, value: string) {
  const input = all(s)[i] as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  await settle();
}
const drafts = () => all(".draft").map(e => (e as HTMLInputElement).value);

it("the page: each module writes the page's store, and the total reads across them", async () => {
  dispose = render(BookingPage, root);
  expect(texts("legend")).toEqual(["Outbound", "Return"]);
  expect(texts(".total")).toEqual(["0"]);
  await click(".book");
  expect(texts(".range output")).toEqual(["1–4", "–"]);
  expect(texts(".total")).toEqual(["300"]);
  await click(".adult");
  await click(".child");
  expect(texts(".guests output")).toEqual(["2+1"]);
  expect(texts(".count")).toEqual(["3 guests"]);
  expect(texts(".total")).toEqual(["900"]);
  // the second picker, under its own provider, edits the other key
  await click(".book", 1);
  await click(".extend", 1);
  expect(texts(".range output")).toEqual(["1–4", "1–5"]);
  expect(texts(".total")).toEqual(["2100"]);
  await click(".clear", 0);
  expect(texts(".total")).toEqual(["1200"]);
});

it("a module alone: no provider, so the picker makes and edits its own store", async () => {
  dispose = render(() => DateRangePicker({ label: "Alone" }), root);
  await click(".book");
  await click(".extend");
  expect(texts(".range output")).toEqual(["1–5"]);
});

it("two instances are independent: two pages, two stores; two lone pickers, two slices", async () => {
  const Twice = component(function* Twice() {
    return view(function* () {
      return (
        <>
          {yield* BookingPage()}
          {yield* BookingPage()}
          {yield* DateRangePicker({ label: "A" })}
          {yield* DateRangePicker({ label: "B" })}
        </>
      );
    });
  });
  dispose = render(Twice, root);
  await click(".adult", 0);
  await click(".book", 3);
  await click(".book", 5);
  expect(texts(".count")).toEqual(["2 guests", "1 guests"]);
  expect(texts(".total")).toEqual(["0", "300"]);
  expect(texts(".range output").slice(4)).toEqual(["–", "1–4"]);
});

it("a required slot needs a provider: the count alone is NO_PROVIDER (the type refuses it, tests/types.ts)", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(() => {
      dispose = render(GuestCount as never, root);
    }).toThrow(/\[NO_PROVIDER\].*GuestsSlot/);
  } finally {
    error.mockRestore();
  }
});

describe("the travellers list: a keyed row's own state and the page's entry for it", () => {
  it("row-owned state lives and dies with the row: re-adding the same id starts collapsed", async () => {
    dispose = render(BookingPage, root);
    await click(".add-traveller");
    expect(texts(".traveller .name")).toEqual(["Traveller 1", "Traveller 2"]);
    await click(".toggle", 1);
    expect(texts(".toggle")).toEqual(["collapsed", "expanded"]);
    await click(".remove-traveller");
    expect(texts(".toggle")).toEqual(["collapsed"]);
    await click(".add-traveller");
    expect(texts(".traveller .name")).toEqual(["Traveller 1", "Traveller 2"]);
    expect(texts(".toggle")).toEqual(["collapsed", "collapsed"]);
  });

  it("prune (the default policy): the draft of a removed traveller is deleted", async () => {
    dispose = render(BookingPage, root);
    await click(".add-traveller");
    await type(".draft", 0, "window seat");
    await type(".draft", 1, "vegetarian");
    expect(drafts()).toEqual(["window seat", "vegetarian"]);
    await click(".remove-traveller");
    expect(drafts()).toEqual(["window seat"]);
    await click(".add-traveller");
    expect(drafts()).toEqual(["window seat", ""]);
  });

  it("keep (the effect left out): the draft survives the removal and comes back on re-add", async () => {
    dispose = render(() => BookingPage({ policy: "keep" }), root);
    await click(".add-traveller");
    await type(".draft", 1, "vegetarian");
    await click(".remove-traveller");
    expect(drafts()).toEqual([""]);
    await click(".add-traveller");
    expect(drafts()).toEqual(["", "vegetarian"]);
  });
});
