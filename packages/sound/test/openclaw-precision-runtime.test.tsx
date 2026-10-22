// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEffect, createMemo, createSignal, flush, Loading, merge } from "solid-js";
import { render } from "@solidjs/web";

const disposals: (() => void)[] = [];
afterEach(() => {
  disposals.splice(0).forEach(dispose => dispose());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("D-133 rc.17 precision checks", () => {
  it("Loading.on consumes a reset key, not an event callback or untracked read", () => {
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [key, setKey] = createSignal("A");
    let calls = 0;
    const heldKey = () => { calls++; throw new Error("not a handler"); };
    function App() {
      return <Loading on={key()} fallback={<p>wait</p>}>
        <Loading on={heldKey} fallback={<p>inner wait</p>}><p>ready</p></Loading>
      </Loading>;
    }
    disposals.push(render(App, document.body));
    flush(); setKey("B"); flush();
    expect(document.body.textContent).toBe("ready");
    expect(calls).toBe(0);
    expect(warnings.mock.calls.flat().map(String).join(" ")).not.toContain("STRICT_READ_UNTRACKED");
  });

  it("moving a pending read outside Loading really needs a boundary", async () => {
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    function App() {
      const read = createMemo(() => Promise.resolve("ready"));
      return <><Loading on="key" fallback={<p>wait</p>}>{null}</Loading><p>{read()}</p></>;
    }
    disposals.push(render(App, document.body)); flush();
    expect(warnings.mock.calls.flat().map(String).join(" ")).toContain("ASYNC_OUTSIDE_LOADING_BOUNDARY");
    for (let i = 0; i < 5; i++) { await Promise.resolve(); flush(); }
    expect(document.body.textContent).toBe("ready");
  });

  it("merge keeps safe bodies but a no-op default does not erase a throwing override", () => {
    const safe = merge({ onChange: (_values: string[]) => {} }, { onChange: (_values: string[]) => {} });
    expect(() => safe.onChange?.(["row"])).not.toThrow();
    const injected = merge({ onChange: (_values: string[]) => {} }, { onChange: (_values: string[]) => { throw new Error("injected"); } });
    expect(() => injected.onChange?.(["row"])).toThrow("injected");
  });

  it("the focus microtask only uses captured native destinations", async () => {
    const retired = document.createElement("button");
    const next = document.createElement("button");
    document.body.append(retired, next);
    const destinations: Array<HTMLButtonElement | undefined> = [retired, undefined, next];
    retired.focus(); retired.remove();
    queueMicrotask(() => {
      if (document.activeElement === document.body) destinations.find(node => node?.isConnected && !node.disabled)?.focus();
    });
    await Promise.resolve();
    expect(document.activeElement).toBe(next);
  });

  it("known safe callback and ref bodies survive forwarding", () => {
    let input: HTMLInputElement | undefined;
    let calls = 0;
    function Leaf(props: { capture: (node: HTMLInputElement) => void; onChange: () => void }) {
      return <input ref={node => props.capture(node)} onClick={() => props.onChange()} />;
    }
    function Middle(props: { capture: (node: HTMLInputElement) => void; onChange: () => void }) {
      return <Leaf capture={props.capture} onChange={props.onChange} />;
    }
    disposals.push(render(() => <Middle capture={node => { input = node; }} onChange={() => { calls++; }} />, document.body));
    flush();
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(calls).toBe(0);
    input?.click();
    expect(calls).toBe(1);
  });

  it("a class method that actually reads a pending memo still throws in apply", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let threw = false;
    function App() {
      const pending = createMemo(() => new Promise<string>(() => {}));
      class Machine { start() { return pending(); } }
      const service = new Machine();
      createEffect(() => 0, () => { try { service.start(); } catch { threw = true; } });
      return <p>ready</p>;
    }
    disposals.push(render(App, document.body)); flush();
    expect(threw).toBe(true);
  });

  it("imperative machine methods in effect apply are synchronous, not pending reads", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: string[] = [];
    class Machine {
      get(_key: string) { return "open"; }
      hasTag(tag: string) { return tag === "open"; }
      computed(_key: string) { return "bottom-start"; }
      subscribe(listener: (value: string) => void) { listener(this.get("layer")); return () => {}; }
      start() { seen.push(this.computed("placement")); }
    }
    function App() {
      const service = new Machine();
      createEffect(() => 0, () => { service.subscribe(value => { seen.push(value); }); service.start(); expect(service.hasTag("open")).toBe(true); });
      return <p>ready</p>;
    }
    disposals.push(render(App, document.body)); flush();
    expect(seen).toEqual(["open", "bottom-start"]);
    expect(errors.mock.calls).toEqual([]);
  });
});
