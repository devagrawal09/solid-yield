// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSignal, createEffect, createContext, useContext, createMemo, createRoot, untrack, Loading, Errored, For, flush, getObserver } from "solid-js";
import { render } from "@solidjs/web";

const disposals: (() => void)[] = [];
afterEach(() => { disposals.splice(0).forEach(dispose => dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); });

describe("D-131 rc.17 runtime scope checks", () => {
  it("effect compute forwards current inputs; apply reads are untracked snapshots", () => {
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [value, setValue] = createSignal("A");
    const forwarded: string[] = [];
    const snapshots: string[] = [];
    function Child(props: { value: string }) {
      const apply = (input: string) => { forwarded.push(input); };
      createEffect(() => props.value, apply);
      createEffect(() => 0, () => { expect(getObserver() == null).toBe(true); snapshots.push(props.value); });
      return <p>listener</p>;
    }
    disposals.push(render(() => <Child value={value()} />, document.body));
    flush(); setValue("B"); flush();
    expect(forwarded).toEqual(["A", "B"]);
    expect(snapshots).toEqual(["A"]);
    expect(warnings.mock.calls.flat().map(String).join(" ")).toContain("STRICT_READ_UNTRACKED");
  });

  it("undefined context defaults throw, null defaults are usable", () => {
    const Missing = createContext<string | undefined>(undefined);
    const Optional = createContext<string | null>(null);
    createRoot(dispose => {
      disposals.push(dispose);
      expect(() => useContext(Missing)).toThrow();
      expect(useContext(Optional)).toBe(null);
    });
  });

  it("default accessors are copied and a provider shadows them", () => {
    let defaults = 0;
    const C = createContext(() => { defaults++; return "default"; });
    createRoot(dispose => {
      disposals.push(dispose);
      const read = useContext(C);
      expect(defaults).toBe(0);
      expect(read()).toBe("default");
    });
    function Child() { const current = useContext(C); return <p>{current()}</p>; }
    disposals.push(render(() => <C value={() => "provided"}><Child /></C>, document.body));
    flush();
    expect(document.body.textContent).toBe("provided");
    expect(defaults).toBe(1);
  });

  it("unused lazy props do not demand a throwing memo getter", () => {
    let reads = 0;
    function Child(_props: { value: string }) { return <p>idle</p>; }
    function App() {
      const read = createMemo<string>(() => { throw new Error("unused"); });
      const observe = () => { reads++; return read(); };
      return <Child value={observe()} />;
    }
    disposals.push(render(App, document.body)); flush();
    expect(reads).toBe(0);
    expect(document.body.textContent).toBe("idle");
  });

  it("a fulfilled record can throw during memo observation inside a child boundary", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    function Child(props: { value: string }) {
      return <Errored fallback={() => <p>failed</p>}><Loading fallback={<p>waiting</p>}><p>{props.value}</p></Loading></Errored>;
    }
    function App() {
      const outcome = createMemo(() => Promise.resolve({ error: "unavailable" }));
      const read = createMemo(() => { const result = outcome(); if (result.error) throw new Error(result.error); return "ready"; });
      return <Child value={read()} />;
    }
    disposals.push(render(App, document.body)); flush();
    for (let i = 0; i < 5; i++) { await Promise.resolve(); flush(); }
    expect(document.body.textContent).toBe("failed");
    // rc.17 reports the caught failure as well as rendering the fallback.
    expect(errors.mock.calls.flat().some(value => value instanceof Error && value.message === "unavailable")).toBe(true);
  });

  it("untrack does not catch a project throw", () => {
    expect(() => untrack(() => { throw new Error("bad"); })).toThrow("bad");
  });

  it("a catch on one promise branch leaves a rejecting fork", async () => {
    const transport = Promise.reject(new Error("write failed"));
    const fork = transport.then(() => "ready");
    const handled = transport.catch(() => "handled");
    // Probe the rejection with an attached assertion, never create an unhandled runtime rejection.
    const probe = expect(fork).rejects.toThrow("write failed");
    expect(await handled).toBe("handled");
    await probe;
  });

  it("key-function rows run setup once, but returned JSX keeps tracking", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const [rows, setRows] = createSignal([{ id: "a", label: "A" }]);
    const [suffix, setSuffix] = createSignal("1");
    let runs = 0;
    const observers: unknown[] = [];
    disposals.push(render(() => <For each={rows()} keyed={row => row.id}>{row => {
      runs++;
      observers.push(getObserver());
      const initial = row().label + suffix();
      return <p data-initial={initial}>{row().label}{suffix()}</p>;
    }}</For>, document.body));
    flush();
    expect(runs).toBe(1);
    expect(document.body.textContent).toBe("A1");
    setSuffix("2"); flush();
    setRows([{ id: "a", label: "B" }]); flush();
    expect(runs).toBe(1);
    expect(document.body.textContent).toBe("B2");
    expect(document.querySelector("p")?.getAttribute("data-initial")).toBe("A1");
    expect(observers.every(observer => observer == null)).toBe(true);
  });

  it("index mode retains row setup by position; rc.17 has no Index export", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const [rows, setRows] = createSignal(["A"]);
    let runs = 0;
    let observer: unknown;
    disposals.push(render(() => <For each={rows()} keyed={false}>{(row, index) => {
      runs++; observer = getObserver();
      const initial = row();
      return <p data-initial={initial}>{index}:{row()}</p>;
    }}</For>, document.body));
    flush(); setRows(["B"]); flush();
    expect(runs).toBe(1);
    expect(observer == null).toBe(true);
    expect(document.body.textContent).toBe("0:B");
    expect(document.querySelector("p")?.getAttribute("data-initial")).toBe("A");
  });

  it("default For uses raw row identity, not a row accessor", () => {
    const first = { label: "A" };
    const [rows, setRows] = createSignal([first]);
    const [suffix, setSuffix] = createSignal("1");
    let runs = 0;
    disposals.push(render(() => <For each={rows()}>{row => {
      runs++; expect(getObserver() == null).toBe(true);
      return <p>{row.label}{suffix()}</p>;
    }}</For>, document.body));
    flush(); setSuffix("2"); flush();
    expect(runs).toBe(1);
    setRows([{ label: "B" }]); flush();
    expect(runs).toBe(2);
    expect(document.body.textContent).toBe("B2");
  });

  it("refs run once at mount without tracking their reads", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const [value, setValue] = createSignal("A");
    let runs = 0;
    let observer: unknown;
    let snapshot = "";
    disposals.push(render(() => <p ref={() => { runs++; observer = getObserver(); snapshot = value(); }}>{value()}</p>, document.body));
    flush();
    expect(runs).toBe(1);
    setValue("B"); flush();
    expect(runs).toBe(1);
    expect(snapshot).toBe("A");
    expect(document.body.textContent).toBe("B");
    expect(observer == null).toBe(true);
  });
});
