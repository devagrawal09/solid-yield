// The three versions of the booking page must show the same results for
// the same clicks. The after version also has a date range that operates alone.
import { flush } from "solid-js";
import { render } from "solid-yield";
import { App } from "../src/app";
import { DateRange } from "../src/after/dateRange";

let dispose: () => void;

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

const root = () => document.getElementById("root")!;

async function click(el: Element | null | undefined) {
  if (!el) throw new Error("click: no element");
  (el as HTMLElement).click();
  for (let i = 0; i < 3; i++) {
    await Promise.resolve();
    flush();
  }
}

/** Queries inside one column (".before", ".after" or ".lens-prop"). */
function page(side: "before" | "after" | "lens-prop") {
  const col = () => root().querySelector(`.${side}`)!;
  // the booking's date range is the first one; the "other" range is in .other
  const day = (n: number, other = false) =>
    [...col().querySelectorAll(other ? ".other .day" : ".booking > fieldset.dates .day")].find(
      b => b.textContent === String(n)
    );
  return {
    day,
    total: () => col().querySelector(".total")!.textContent,
    count: (kind: "adults" | "kids") => col().querySelector(`.${kind} .count`)!.textContent,
    plus: (kind: "adults" | "kids") => col().querySelector(`.${kind} .plus`),
    minus: (kind: "adults" | "kids") => col().querySelector(`.${kind} .minus`),
    reset: () => col().querySelector(".reset"),
    picked: (other = false) =>
      [...col().querySelectorAll(other ? ".other .picked" : ".booking > fieldset.dates .picked")].map(
        b => b.textContent
      )
  };
}

describe.each(["before", "after", "lens-prop"] as const)("booking page (%s)", side => {
  beforeEach(() => {
    dispose = render(App, root());
  });

  it("starts with no dates, one adult and a total of 0", () => {
    const p = page(side);
    expect(p.total()).toBe("Total: 0");
    expect(p.count("adults")).toBe("1");
    expect(p.count("kids")).toBe("0");
  });

  it("prices the nights for each guest", async () => {
    const p = page(side);
    await click(p.day(3));
    await click(p.day(7));
    expect(p.picked()).toEqual(["3", "7"]);
    expect(p.total()).toBe("Total: 200");
    await click(p.plus("adults"));
    await click(p.plus("kids"));
    expect(p.total()).toBe("Total: 600");
  });

  it("starts a new range on a third pick", async () => {
    const p = page(side);
    await click(p.day(3));
    await click(p.day(7));
    await click(p.day(5));
    expect(p.picked()).toEqual(["5"]);
    expect(p.total()).toBe("Total: 0");
  });

  it("keeps the guest limit of 6 and at least one adult", async () => {
    const p = page(side);
    for (let i = 0; i < 8; i++) await click(p.plus("kids"));
    expect(p.count("kids")).toBe("5");
    await click(p.minus("adults"));
    expect(p.count("adults")).toBe("1");
  });

  it("resets the full booking", async () => {
    const p = page(side);
    await click(p.day(2));
    await click(p.day(4));
    await click(p.plus("adults"));
    await click(p.reset());
    expect(p.picked()).toEqual([]);
    expect(p.count("adults")).toBe("1");
    expect(p.total()).toBe("Total: 0");
  });

  it("keeps the other date range separate from the booking", async () => {
    const p = page(side);
    await click(p.day(1, true));
    await click(p.day(9, true));
    expect(p.picked(true)).toEqual(["1", "9"]);
    expect(p.picked()).toEqual([]);
    expect(p.total()).toBe("Total: 0");
  });
});

describe("after: a module without a binding", () => {
  it("operates alone with its local store", async () => {
    dispose = render(DateRange, root());
    const day = (n: number) => [...root().querySelectorAll(".day")].find(b => b.textContent === String(n));
    await click(day(4));
    await click(day(6));
    expect([...root().querySelectorAll(".picked")].map(b => b.textContent)).toEqual(["4", "6"]);
    expect([...root().querySelectorAll(".in-range")].map(b => b.textContent)).toEqual(["5"]);
  });
});
