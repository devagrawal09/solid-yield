// The Solid × Effect twin driven through jsdom, compiled by the native
// compiler with the block rule: tabs, the typeahead read path (loading, results, supersede →
// fiber interruption, stale-while-revalidate, empty results, retries giving
// up into <Errored>, reset), the fiber log, and the checkout saga (cart
// edits, the optimistic phase, success, a typed decline, cancellation with
// compensation, the orders list).
import { render } from "@solidjs/blocks";
import { App } from "../src/app";
import {
  $,
  $$,
  advance,
  button,
  click,
  install,
  logLines,
  root,
  setRandom,
  type,
  uninstall
} from "./script";

let dispose: () => void;

beforeEach(async () => {
  install();
  dispose = render(App, root());
  await advance(0);
  // The log and the orders "database" are module state, shared by the tests
  // in this file: start each one with an empty log.
  await click(button("Clear"));
});
afterEach(() => {
  dispose();
  uninstall();
});

const names = () => $$(".pkg-name").map(e => e.textContent);
const cartQuantities = () => $$(".cart-row .qty").map(q => q.textContent!.replace(/[−+]/g, ""));
const stepClasses = () => $$(".steps li").map(li => li.className);

describe("effect typeahead with @solidjs/blocks", () => {
  it("starts on the typeahead tab with an empty log", () => {
    expect(button("Typeahead")!.className).toBe("selected");
    expect(button("Checkout")!.className).toBe("");
    expect($("h2")!.textContent).toBe("Typeahead search");
    expect($(".log-panel .empty")!.textContent).toBe("Interact to see fiber lifecycle events.");
    expect($(".results")).toBeNull();
  });

  it("searches, shows results sorted by downloads, and logs the fiber", async () => {
    await type("vite");
    // A fresh memo with no value yet: the results panel renders its own
    // pending state (as the original does), not the <Loading> fallback.
    expect($(".results")!.className).toBe("results stale");
    expect($(".results .empty")!.textContent).toBe("Searching…");
    expect(logLines()).toEqual(['start: search "vite" — fiber started']);
    await advance(1000);
    expect($(".results")!.className).toBe("results");
    expect(names()).toEqual(["vite", "vitest", "vinxi"]);
    expect($$(".pkg-downloads").map(e => e.textContent)).toEqual([
      "12.4M/wk",
      "6.2M/wk",
      "380k/wk"
    ]);
    expect(logLines()[0]).toBe('success: search "vite" → 3 results');
  });

  it("interrupts a superseded flight's fiber", async () => {
    await type("s");
    await type("so");
    await advance(1000);
    expect(logLines()).toContain(
      'interrupt: search "s" interrupted — fiber + pending retries torn down'
    );
    expect(logLines().filter(l => l.startsWith("success"))).toEqual([
      'success: search "so" → 10 results'
    ]);
  });

  it("keeps the previous results, marked stale, while revalidating", async () => {
    await type("so");
    await advance(1000);
    const before = names();
    await type("sol");
    await advance(300);
    expect($(".results")!.className).toBe("results stale");
    expect(names()).toEqual(before);
    await advance(1000);
    expect($(".results")!.className).toBe("results");
    expect(names()).not.toEqual(before);
    expect(names()).toHaveLength(9);
  });

  it("says when nothing matches, and hides the results for an empty query", async () => {
    await type("zzz");
    await advance(1000);
    expect($(".results .empty")!.textContent).toBe("No packages match “zzz”.");
    await type("   ");
    expect($(".results")).toBeNull();
  });

  it("gives up after retries into the error boundary, and recovers on reset", async () => {
    setRandom(0.1);
    await type("vite");
    await advance(1500);
    expect(logLines().filter(l => l.startsWith("retry")).length).toBeGreaterThan(0);
    await advance(4000);
    expect($(".error-box p")!.textContent).toBe("Search gave up after retries: TransientNetwork");
    setRandom(0.9);
    await click(button("Try again"));
    await advance(1000);
    expect($(".error-box")).toBeNull();
    expect(names()).toEqual(["vite", "vitest", "vinxi"]);
  });

  it("clears the log", async () => {
    await type("vite");
    await advance(1000);
    expect(logLines().length).toBeGreaterThan(0);
    await click(button("Clear"));
    expect(logLines()).toEqual([]);
    expect($(".log-panel .empty")).not.toBeNull();
  });
});

describe("effect checkout with @solidjs/blocks", () => {
  beforeEach(async () => {
    await click(button("Checkout"));
  });

  it("switches tabs and loads the (empty) orders", async () => {
    expect(button("Checkout")!.className).toBe("selected");
    expect($("h2")!.textContent).toBe("Checkout saga");
    expect($(".loading")!.textContent).toBe("Loading orders…");
    await advance(400);
    expect($(".empty")!.textContent).toBe("No orders yet.");
    expect(cartQuantities()).toEqual(["1", "2", "1"]);
    expect($(".total .cart-price")!.textContent).toBe("$78.74");
    expect(button("Place order")!.textContent).toBe("Place order — $78.74");
  });

  it("edits quantities; − is disabled at one", async () => {
    await advance(400);
    const row = (i: number) => $$(".cart-row")[i].querySelectorAll("button");
    expect(row(0)[0].disabled).toBe(true);
    await click(row(0)[1]);
    expect(cartQuantities()).toEqual(["2", "2", "1"]);
    expect(row(0)[0].disabled).toBe(false);
    expect($$(".cart-row .cart-price")[0].textContent).toBe("$39.98");
    await click(row(1)[0]);
    expect(cartQuantities()).toEqual(["2", "1", "1"]);
    expect($(".total .cart-price")!.textContent).toBe("$74.23");
  });

  it("runs the saga step by step, then lists the order", async () => {
    await advance(400);
    await click(button("Place order"));
    expect(button("Cancel checkout")).toBeDefined();
    expect(stepClasses()).toEqual(["active", "", ""]);
    expect($$<HTMLButtonElement>(".cart-row .qty button").every(b => b.disabled)).toBe(true);
    await advance(1000);
    expect(stepClasses()).toEqual(["done", "active", ""]);
    await advance(2600);
    expect(stepClasses()).toEqual(["done", "done", "active"]);
    await advance(1200);
    expect(button("Place order")).toBeDefined();
    expect(stepClasses()).toEqual(["", "", ""]);
    expect($(".notice")!.className).toBe("notice success");
    expect($(".notice")!.textContent).toMatch(/^Order ord_\d+ confirmed — \$78\.74$/);
    expect($$(".orders li").length).toBeGreaterThan(0);
    expect($$(".orders .pkg-desc").at(-1)!.textContent).toMatch(/^3 lines · placed 12:00:0\d PM$/);
  });

  it("reverts on a typed card decline, with compensation", async () => {
    await advance(400);
    const box = $<HTMLInputElement>(".decline-toggle input")!;
    box.checked = true;
    box.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await advance(0);
    await click(button("Place order"));
    await advance(3600);
    await advance(1000);
    expect($(".notice")!.className).toBe("notice error");
    expect($(".notice")!.textContent).toBe(
      "Card declined for $78.74 — refunds/releases applied, cart untouched"
    );
    expect(stepClasses()).toEqual(["", "", ""]);
    expect(logLines().some(l => l.startsWith("compensate: releaseReservation"))).toBe(true);
    // No order was created.
    expect(logLines().some(l => l.startsWith("success: createOrder"))).toBe(false);
  });

  it("cancels mid-charge: the fiber is interrupted and compensations run", async () => {
    await advance(400);
    await click(button("Place order"));
    await advance(2000);
    await click(button("Cancel checkout"));
    await advance(1500);
    expect($(".notice")!.className).toBe("notice info");
    expect($(".notice")!.textContent).toBe(
      "Checkout cancelled — compensations ran, cart untouched"
    );
    expect(logLines()).toContain("compensate: chargeCard interrupted — voiding card authorization");
    expect(button("Place order")).toBeDefined();
  });
});
