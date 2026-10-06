// The Sierpinski twin driven through jsdom (native compiler, the yield rule):
// the loading fallback, the async per-branch memos, the seconds ticker, the
// frame-driven scale, hover, and disposal.
import { render } from "solid-yield";
import { TriangleDemo } from "../src/app";
import { advance, dots, installClocks, uninstallClocks } from "./script";

let dispose: () => void;

beforeEach(() => {
  document.body.innerHTML = "";
  installClocks();
  dispose = render(TriangleDemo, document.body);
});
afterEach(() => {
  dispose();
  uninstallClocks();
});

const container = () => document.body.querySelector<HTMLElement>(".container");
const labels = () => new Set(dots().map(d => d.textContent));

describe("sierpinski with solid-yield", () => {
  it("shows the fallback until every branch's idle callback resolves", async () => {
    expect(document.body.textContent).toBe("Loading...");
    expect(container()).toBeNull();
    await advance(20);
    expect(container()).not.toBeNull();
    // 1000 → 25: six halvings, 3^6 dots.
    expect(dots()).toHaveLength(729);
    expect(labels()).toEqual(new Set(["0"]));
  });

  it("positions and sizes each dot like the original", async () => {
    await advance(20);
    const first = dots()[0];
    expect(first.style.width).toBe("25px");
    expect(first.style.height).toBe("25px");
    expect(first.style.borderRadius).toBe("12.5px");
    expect(first.style.lineHeight).toBe("25px");
    expect(first.style.background).toBe("rgb(97, 218, 251)");
    // The first leaf: repeatedly the top child (x unchanged, y - s/2).
    let y = 0;
    for (let s = 500; s >= 15.625; s /= 2) y -= s / 2;
    expect(first.style.left).toBe(`${0 - 25 / 2}px`);
    expect(first.style.top).toBe(`${y - 25 / 2}px`);
  });

  it("ticks the seconds through the async memos and keeps the old value meanwhile", async () => {
    await advance(20);
    await advance(1000);
    // The tick lands, the branch memos wait for idle callbacks; nothing
    // falls back to "Loading..." again.
    expect(container()).not.toBeNull();
    await advance(20);
    expect(labels()).toEqual(new Set(["1"]));
    await advance(1000);
    await advance(20);
    expect(labels()).toEqual(new Set(["2"]));
    // Seconds wrap: (s % 10) + 1.
    await advance(8000);
    await advance(20);
    expect(labels()).toEqual(new Set(["10"]));
    await advance(1000);
    await advance(20);
    expect(labels()).toEqual(new Set(["1"]));
  }, 30_000); // CPU-bound: fake timers render every frame of 8 s of ticks; 5 s is too tight on a loaded machine

  it("scales the container from the animation frames", async () => {
    await advance(20);
    const initial = container()!.style.transform;
    expect(initial).toMatch(/^scaleX\(0\.47\d*\) scaleY\(0\.7\) translateZ\(0\.1px\)$/);
    await advance(2500);
    // elapsed ≈ 2.5 s → scale 1.25 → scaleX(1.25 / 2.1)
    const x = Number(/scaleX\(([\d.]+)\)/.exec(container()!.style.transform)![1]);
    expect(x).toBeGreaterThan(0.58);
    expect(x).toBeLessThan(0.61);
  });

  it("highlights a hovered dot and restores it on leave", async () => {
    await advance(20);
    const dot = dots()[5];
    dot.dispatchEvent(new MouseEvent("mouseenter"));
    await advance(0);
    expect(dot.textContent).toBe("**0**");
    expect(dot.style.background).toBe("rgb(255, 255, 0)");
    expect(dots()[4].textContent).toBe("0");
    dot.dispatchEvent(new MouseEvent("mouseleave"));
    await advance(0);
    expect(dot.textContent).toBe("0");
    expect(dot.style.background).toBe("rgb(97, 218, 251)");
  });

  it("stops the interval and frame loop on dispose", async () => {
    await advance(20);
    dispose();
    dispose = () => {};
    expect(document.body.innerHTML).toBe("");
    // No timer left to run.
    await advance(5000);
    expect(document.body.innerHTML).toBe("");
  });
});
