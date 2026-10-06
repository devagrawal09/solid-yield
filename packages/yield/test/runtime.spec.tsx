/**
 * Runtime tests. Views here are written in the form the JSX transform's yield
 * rule produces (`{perform(x)}` for `{yield* x}`), so they run with or
 * without the rule; `transform.spec.tsx` covers the `yield*` spelling.
 */
import { flush, createRoot, isPending, Reveal, untrack } from "solid-js";
import {
  $cleanup,
  component,
  $effect,
  $event,
  $memo,
  $optimistic,
  $optimisticStore,
  $projection,
  isPendingOf,
  lazy,
  $settled,
  $signal,
  $store,
  attempt,
  constant,
  createContext,
  Errored,
  For,
  Loading,
  Match,
  perform,
  raise,
  readStore,
  refresh,
  render,
  Repeat,
  Show,
  Switch,
  until,
  type ChildView,
  type Element as YieldElement,
  type EventHandler,
  type Props,
  type Source,
  type ViewFn,
  view
} from "solid-yield";
import { createSignal as plainSignal } from "solid-js";
import { holeOf, rowArg } from "solid-yield/internal";
import { INSTANCE, registerInstance } from "../src/runtime.js";
import { h } from "solid-yield/h";
import { Failed, toFailed } from "./failed.js";
import { write } from "./write.js";

declare const __DEV__: boolean;
/** Dev-only checks (warnings, dev errors) are skipped against production builds. */
const devIt = __DEV__ ? it : it.skip;

const tick = () => new Promise<void>(r => setTimeout(r, 0));

const toError = toFailed;

async function settle(times = 3) {
  for (let i = 0; i < times; i++) {
    await tick();
    flush();
  }
}

let root: HTMLDivElement;
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

function mount(App: () => any) {
  dispose = render(App as any, root);
  flush();
}

describe("views are fine-grained", () => {
  it("runs the view once; holes update independently; the input keeps its text", () => {
    let viewRuns = 0;
    let bump!: () => void;
    const Counter = component(function* () {
      const [n, setN] = yield* $signal(0);
      bump = () => write(() => setN(v => v + 1));
      return view(function* () {
        viewRuns++;
        return (
          <div>
            <p class={{ big: perform(n) > 3 }}>Count {perform(n)}</p>
            <input />
          </div>
        );
      });
    });
    mount(Counter);
    const input = root.querySelector("input")!;
    input.value = "typed";
    for (let i = 0; i < 5; i++) {
      bump();
      flush();
    }
    expect(root.querySelector("p")!.textContent).toBe("Count 5");
    expect(root.querySelector("p")!.className).toBe("big");
    expect(root.querySelector("input")).toBe(input);
    expect(input.value).toBe("typed");
    expect(viewRuns).toBe(1);
  });

  it("an async memo suspends to Loading and resolves; the view still runs once", async () => {
    let viewRuns = 0;
    let resolve!: (v: { name: string }) => void;
    const User = component(function* () {
      const user = yield* $memo(function* () {
        return yield* attempt(() => new Promise<{ name: string }>(r => (resolve = r)), toError);
      });
      return view(function* () {
        viewRuns++;
        return <h3>Hello {perform(user).name}</h3>;
      });
    });
    mount(() =>
      Loading({
        fallback: function* () {
          return <i>loading</i>;
        },
        children: function* () {
          return <>{yield* User()}</>;
        }
      })
    );
    expect(root.innerHTML).toContain("<i>loading</i>");
    resolve({ name: "Ada" });
    await settle();
    expect(root.querySelector("h3")!.textContent).toBe("Hello Ada");
    expect(viewRuns).toBe(1);
  });

  it("a memo with a loadingValue renders it without a boundary, then its answer", async () => {
    let resolve!: (v: { name: string }) => void;
    const User = component(function* () {
      const user = yield* $memo(
        function* () {
          return yield* attempt(() => new Promise<{ name: string }>(r => (resolve = r)), toError);
        },
        { loadingValue: { name: "…" } }
      );
      const pending = isPendingOf(user);
      return view(function* () {
        return <h3 class={{ pending: perform(pending) }}>Hello {perform(user).name}</h3>;
      });
    });
    mount(User);
    expect(root.querySelector("h3")!.textContent).toBe("Hello …");
    resolve({ name: "Ada" });
    await settle();
    expect(root.querySelector("h3")!.textContent).toBe("Hello Ada");
    expect(root.querySelector("h3")!.className).toBe("");
  });

  devIt("a view does not read: a read outside a JSX position is READ_IN_VIEW", () => {
    // (no type error: TypeScript types a yield* in JSX — a hole — and one in a
    // statement alike; the lint `no-read-in-view-body` reports it)
    const ReadsInBody = component(function* ReadsInBody() {
      const [n] = yield* $signal(1);
      return view(function* () {
        const v = yield* n;
        return <b>{v}</b>;
      });
    });
    expect(() => createRoot(() => ReadsInBody())).toThrow(/READ_IN_VIEW.*<ReadsInBody>/);
    // a branch on a read is one too: structure comes from flow controls
    const Branches = component(function* Branches() {
      const [open] = yield* $signal(true);
      return view(function* () {
        if (yield* open) return <b>open</b>;
        return <i>closed</i>;
      });
    });
    expect(() => createRoot(() => Branches())).toThrow(/READ_IN_VIEW.*<Branches>/);
    // in a row's view, named by the row
    const Rows = component(function* Rows() {
      return view(function* () {
        return (
          <ul>
            {
              yield* For({
                each: ["a"],
                children: function* item(x) {
                  return view(function* () {
                    const t = yield* x;
                    return <li>{t}</li>;
                  });
                }
              })
            }
          </ul>
        );
      });
    });
    expect(() => createRoot(() => Rows())).toThrow(/READ_IN_VIEW.*<row item>/);
    // the same reads in holes, and a flow control reading its source, are the holes'
    let set!: (v: boolean) => void;
    const Holes = component(function* Holes() {
      const [open, setOpen] = yield* $signal(true);
      set = v => write(() => setOpen(v));
      return view(function* () {
        return (
          <p>
            {perform(open) ? "open" : "closed"}
            {
              yield* Show({
                when: open,
                children: function* () {
                  return <b>!</b>;
                }
              })
            }
          </p>
        );
      });
    });
    mount(Holes);
    expect(root.textContent).toBe("open!");
    set(false);
    flush();
    expect(root.textContent).toBe("closed");
  });
});

describe("components", () => {
  it("a named setup names the component (dev owner labels)", () => {
    const Greeting = component(function* Greeting() {
      return view(function* () {
        return <b>hi</b>;
      });
    });
    const Anonymous = component(function* () {
      return view(function* () {
        return <b>hi</b>;
      });
    });
    expect(Greeting.name).toBe("Greeting");
    expect(Anonymous.name).toBe("component");
  });
});

describe("setup operations", () => {
  it("$memo derives; $effect runs after changes and cleans up; $settled runs once", () => {
    const log: string[] = [];
    let set!: (v: number) => void;
    const App = component(function* () {
      const [n, setN] = yield* $signal(1);
      set = v => write(() => setN(v));
      const doubled = yield* $memo(function* () {
        return (yield* n) * 2;
      });
      yield* $effect(
        function* () {
          return yield* doubled;
        },
        function* (d) {
          log.push(`effect ${d}`);
          yield* $cleanup(() => log.push(`cleanup ${d}`));
        }
      );
      yield* $settled(function* () {
        log.push(`settled ${yield* doubled}`);
      });
      return view(function* () {
        return <span>{perform(doubled)}</span>;
      });
    });
    mount(App);
    expect(root.textContent).toBe("2");
    set(2);
    flush();
    expect(root.textContent).toBe("4");
    expect(log).toEqual(["effect 2", "settled 2", "cleanup 2", "effect 4"]);
  });

  it("an $effect's writes apply", () => {
    let set!: (v: number) => void;
    const App = component(function* () {
      const [n, setN] = yield* $signal(1);
      const [copy, setCopy] = yield* $signal(0);
      set = v => write(() => setN(v));
      yield* $effect(
        function* () {
          return yield* n;
        },
        function* (v) {
          const written = yield* setCopy(v * 10);
          expect(written).toBe(v * 10);
        }
      );
      return view(function* () {
        return <span>{perform(copy)}</span>;
      });
    });
    mount(App);
    flush();
    expect(root.textContent).toBe("10");
    set(3);
    flush();
    flush();
    expect(root.textContent).toBe("30");
  });

  it("$store paths and readStore selections are tracked reads", () => {
    let toggle!: () => void;
    const App = component(function* () {
      const [todos, setTodos] = yield* $store({ list: [{ title: "a", done: false }] });
      toggle = () =>
        write(() =>
          setTodos(s => {
            s.list[0].done = !s.list[0].done;
          })
        );
      const remaining = readStore(todos, t => t.list.filter(x => !x.done).length);
      return view(function* () {
        return (
          <p>
            {perform(todos.list[0].title)} {String(perform(todos.list[0].done))}{" "}
            {perform(remaining)}
          </p>
        );
      });
    });
    mount(App);
    expect(root.textContent).toBe("a false 1");
    toggle();
    flush();
    expect(root.textContent).toBe("a true 0");
  });

  it("reads track where the host tracks: a memo and a compute subscribe; an event and the effect phase do not (D-083)", async () => {
    let setA!: (v: number) => void;
    let setB!: (v: number) => void;
    let fire!: () => Promise<unknown>;
    const seen: string[] = [];
    const runs = { memo: 0, compute: 0, effect: 0 };
    const App = component(function* () {
      const [a, sa] = yield* $signal(1);
      const [b, sb] = yield* $signal(10);
      setA = v => write(() => sa(v));
      setB = v => write(() => sb(v));
      const doubled = yield* $memo(function* () {
        runs.memo++;
        return (yield* b) * 2;
      });
      yield* $effect(
        function* () {
          runs.compute++;
          return yield* b;
        },
        function* (v) {
          runs.effect++;
          // a plain read: untracked, because the effect phase is
          seen.push(`effect ${v} ${yield* a}`);
        }
      );
      fire = $event(function* () {
        seen.push(`event ${yield* a}`);
      });
      return view(function* () {
        return <i>{perform(doubled)}</i>;
      });
    });
    mount(() => App());
    flush();
    expect(root.textContent).toBe("20");
    expect(seen).toEqual(["effect 10 1"]);
    // a is read only in the effect phase and the event: nothing re-runs
    setA(5);
    flush();
    expect(runs).toEqual({ memo: 1, compute: 1, effect: 1 });
    // b is read in the memo and the compute: both re-run, and the effect phase reads a's value now
    setB(20);
    flush();
    expect(root.textContent).toBe("40");
    expect(runs).toEqual({ memo: 2, compute: 2, effect: 2 });
    await fire();
    expect(seen).toEqual(["effect 10 1", "effect 20 5", "event 5"]);
  });

  it("an $effect whose compute reads a pending source waits; no Loading shows (D-090)", async () => {
    let resolve!: (v: string) => void;
    const seen: string[] = [];
    const Watcher = component(function* Watcher() {
      const user = yield* $memo(function* () {
        return yield* attempt(() => new Promise<string>(r => (resolve = r)), toError);
      });
      yield* $effect(
        function* () {
          return yield* user;
        },
        function* (name) {
          seen.push(name);
        }
      );
      // the view reads nothing pending: only the effect waits on `user`
      return view(function* () {
        return <i>shown</i>;
      });
    });
    mount(() =>
      Loading({
        fallback: function* () {
          return <p>loading</p>;
        },
        children: function* () {
          return <>{yield* Watcher()}</>;
        }
      })
    );
    expect(root.textContent).toBe("shown");
    await settle();
    // the compute waits silently: the Loading above shows its content, and
    // the effect phase has not run (only render effects, holes, notify Loading)
    expect(root.textContent).toBe("shown");
    expect(seen).toEqual([]);
    resolve("ada");
    await settle();
    expect(root.textContent).toBe("shown");
    expect(seen).toEqual(["ada"]);
  });

  it("Loading's on: its pending is the Loading's own, its failure passes above (D-071)", async () => {
    let resolve!: (v: string) => void;
    let reject!: (e: unknown) => void;
    let refetch!: () => void;
    const Page = component(function* Page() {
      const [which, setWhich] = yield* $signal(0);
      refetch = () => write(() => setWhich(1));
      const key = yield* $memo(function* () {
        yield* which;
        return yield* attempt(
          () =>
            new Promise<string>((r, j) => {
              resolve = r;
              reject = j;
            }),
          toError
        );
      });
      return view(function* () {
        return (
          <>
            {
              yield* Loading({
                on: key,
                fallback: function* () {
                  return <p>inner</p>;
                },
                children: function* () {
                  return <i>content</i>;
                }
              })
            }
          </>
        );
      });
    });
    mount(() =>
      Errored({
        fallback: (e: () => unknown) => <p>failed {(e() as Error).message}</p>,
        children: () =>
          Loading({
            fallback: function* () {
              return <p>outer</p>;
            },
            children: () => Page()
          })
      })
    );
    // `on` pending is the Loading's own: Solid reads it outside the boundary's
    // tree and drops its pending, so neither fallback shows; nothing under
    // this Loading is pending, so it shows its content
    expect(root.textContent).toBe("content");
    await settle();
    expect(root.textContent).toBe("content");
    resolve("a");
    await settle();
    expect(root.textContent).toBe("content");
    refetch();
    await settle();
    expect(root.textContent).toBe("content");
    // `on` failing is not a Loading's to handle: it reaches the Errored above
    reject(new Error("no key"));
    await settle();
    expect(root.textContent).toBe("failed no key");
  });

  devIt("a setup does not read: READ_IN_SETUP", () => {
    // @ts-expect-error a setup does not read (Read is not a SetupOp)
    const Bad = component(function* (props: Props<{ start: number }>) {
      const v = yield* props.start;
      return view(function* () {
        return <i>{v}</i>;
      });
    });
    expect(() => createRoot(() => Bad({ start: 1 }))).toThrow(/READ_IN_SETUP/);
  });

  devIt("creating outside a setup and writing in a memo are dev errors", () => {
    const CreatesInView = component(function* () {
      // @ts-expect-error a view only reads (Create is not a ViewOp)
      return view(function* () {
        const [x] = yield* $signal(1);
        return <i>{perform(x)}</i>;
      });
    });
    expect(() => createRoot(() => CreatesInView())).toThrow(/CREATE_OUTSIDE_SETUP/);
    let error: unknown;
    const WritesInMemo = component(function* () {
      const [n, setN] = yield* $signal(1);
      const m = yield* $memo(function* () {
        // a memo's own write: the receipt delegated to right here (its dev
        // error caught by an absorbing attempt, D-077)
        yield* attempt(
          () => void [...setN(2)],
          e => {
            error = e;
          }
        );
        return yield* n;
      });
      return view(function* () {
        return <i>{perform(m)}</i>;
      });
    });
    mount(WritesInMemo);
    expect(String(error)).toMatch(/WRITE_IN_REACTIVE/);
  });
});

describe("the runtime's other dev errors", () => {
  // Each is also a type error or a lint error where the syntax allows it;
  // these reach the runtime through casts / plain JS.
  const hole = (body: () => Generator<unknown, unknown, unknown>) => holeOf(body);

  devIt("operations in the wrong host", () => {
    const Ctx = createContext("x");
    // an async attempt suspends: only a $memo or an $event may wait
    expect(() =>
      perform(
        hole(function* () {
          return yield* attempt(() => Promise.resolve(1), toError);
        })
      )
    ).toThrow(/ASYNC_NOT_ALLOWED/);
    // a plain yield is not an operation
    expect(() =>
      perform(
        hole(function* () {
          yield 1;
        })
      )
    ).toThrow(/NOT_AN_OPERATION/);
    // $cleanup belongs to a setup or an effect
    expect(() =>
      perform(
        hole(function* () {
          yield* $cleanup(() => {});
        })
      )
    ).toThrow(/CLEANUP_OUTSIDE_OWNER/);
    // yield* Ctx belongs to a setup
    expect(() =>
      perform(
        hole(function* () {
          return yield* Ctx;
        })
      )
    ).toThrow(/CONTEXT_OUTSIDE_SETUP/);
  });

  devIt("JSX in a setup is JSX_IN_SETUP (D-041)", () => {
    const Builds = component(function* Builds() {
      const [title] = yield* $signal("t");
      const header = <h1>{perform(title)}</h1>;
      return view(function* () {
        return header;
      });
    });
    expect(() => createRoot(() => Builds())).toThrow(/JSX_IN_SETUP\] <Builds>: JSX in a setup/);
  });

  devIt("a setup returns its view; a path is not writable", () => {
    const NoView = component(function* () {
      return 1;
    } as unknown as () => Generator<never, ViewFn<never, null>>);
    expect(() => createRoot(() => NoView())).toThrow(/COMPONENT_VIEW/);
    const p = rowArg({ a: 1 }, false) as unknown as { a: number };
    expect(() => {
      p.a = 2;
    }).toThrow(/PATH_WRITE/);
  });

  devIt("a second copy of the runtime is an error naming both module URLs", async () => {
    const g = globalThis as any;
    // this copy registered itself when it loaded
    const registered = g[INSTANCE] as { url: string };
    expect(registered.url).toMatch(/\/src\/runtime\.ts$/);
    try {
      // the same module evaluated again at its URL (a re-import) is not a copy
      await import("../src/runtime.ts?again" as string);
      // another copy (a duplicated dependency) loaded first: loading this one fails
      const other = "file:///app/node_modules/.pnpm/solid-yield@0.0.0/dist/yield.dev.js";
      g[INSTANCE] = { url: other };
      let error: unknown;
      try {
        await import("../src/runtime.ts?copy" as string);
      } catch (e) {
        error = e;
      }
      expect(String(error)).toMatch(/DUPLICATE_RUNTIME/);
      expect(String(error)).toContain(other);
      expect(String(error)).toContain(registered.url);
      // a copy whose URL is unknown cannot be told apart from another one
      expect(() => registerInstance(undefined)).toThrow(/DUPLICATE_RUNTIME.*\(unknown URL\)/);
    } finally {
      g[INSTANCE] = registered;
    }
  });

  devIt("a path is a read, not an object: enumerating or changing it is PATH_OBJECT", () => {
    const p = rowArg({ user: { name: "Ada" }, items: ["a"] }, false) as any;
    expect(() => ({ ...p.user })).toThrow(/PATH_OBJECT/);
    expect(() => Object.keys(p)).toThrow(/PATH_OBJECT/);
    expect(() => Object.getOwnPropertyDescriptor(p, "user")).toThrow(/PATH_OBJECT/);
    expect(() => Object.defineProperty(p, "x", { value: 1 })).toThrow(/PATH_OBJECT/);
    expect(() => delete p.user).toThrow(/PATH_OBJECT/);
  });

  it("a path printed or coerced describes itself", () => {
    const p = rowArg({ user: { name: "Ada" }, items: ["a"] }, false) as any;
    expect(String(p.user.name)).toBe("[path .user.name]");
    expect(`${p.items[0]}`).toBe("[path .items[0]]");
    expect(JSON.stringify({ v: p.user })).toBe('{"v":"[path .user]"}');
    expect(String(p)).toBe("[path (root)]");
    // still a read: yield* gives the value
    expect([...p.user.name]).toEqual([]);
    expect(perform(p.user.name)).toBe("Ada");
  });

  devIt("a memo's reads after its first async attempt are errors", async () => {
    const Late = component(function* () {
      const [n] = yield* $signal(1);
      const m = yield* $memo(function* () {
        yield* attempt(() => Promise.resolve(0), toError);
        return yield* n;
      });
      return view(function* () {
        return <i>{perform(m)}</i>;
      });
    });
    mount(() =>
      Loading({
        fallback: "…",
        children: function* () {
          return (
            <>
              {
                yield* Errored({
                  fallback: e => <b>{String(e())}</b>,
                  children: function* () {
                    return <>{yield* Late()}</>;
                  }
                })
              }
            </>
          );
        }
      })
    );
    await settle();
    expect(root.textContent).toMatch(/READ_AFTER_ATTEMPT/);
  });
});

describe("setups inside a parent's first view run", () => {
  it("a child's setup (and its memo's first pass) is not a read at the parent view's top level", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let parentRuns = 0;
    const Leaf = component(function* (props: Props<{ n: number }>) {
      const n = yield* $memo(function* () {
        return yield* props.n;
      });
      return view(function* () {
        return <i>{perform(n)}</i>;
      });
    });
    const Parent = component(function* () {
      return view(function* () {
        parentRuns++;
        return <p>{perform(Leaf({ n: 1 }))}</p>;
      });
    });
    mount(Parent);
    expect(root.textContent).toBe("1");
    expect(parentRuns).toBe(1);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("props", () => {
  it("props are reads; forwarding a source forwards the read; paths walk deep", () => {
    let setName!: (v: string) => void;
    let childRuns = 0;
    const Card = component(function* (props: Props<{ user: { name: string }; tag: string }>) {
      return view(function* () {
        childRuns++;
        return (
          <p>
            {perform(props.tag)}:{perform(props.user.name)}
          </p>
        );
      });
    });
    const Parent = component(function* () {
      const [user, setUser] = yield* $signal({ name: "a" });
      setName = name => write(() => setUser({ name }));
      return view(function* () {
        return <>{yield* Card({ user: user, tag: "t" })}</>;
      });
    });
    mount(Parent);
    expect(root.textContent).toBe("t:a");
    setName("b");
    flush();
    expect(root.textContent).toBe("t:b");
    expect(childRuns).toBe(1);
  });

  it("a setter call does nothing until it is delegated to; in development an undelegated receipt is UNYIELDED_WRITE", async () => {
    let poke!: () => Promise<unknown>;
    let bump!: () => void;
    const App = component(function* App() {
      const [n, setN] = yield* $signal(0);
      poke = $event(function* () {
        void setN(1);
      });
      bump = () => write(() => setN(2));
      return view(function* () {
        return <i>{perform(n)}</i>;
      });
    });
    mount(App);
    const failure = await poke().then(
      () => null,
      e => e
    );
    flush();
    expect(root.textContent).toBe("0");
    if (__DEV__) expect(String(failure)).toMatch(/UNYIELDED_WRITE\] a \$signal's setter in <App>/);
    else expect(failure).toBe(null);
    bump();
    flush();
    expect(root.textContent).toBe("2");
  });

  devIt(
    "an $effect's compute does not write; its effect phase reads, untracked (D-079, D-083)",
    () => {
      const errorOf = (App: () => any) => {
        dispose?.();
        root.textContent = "";
        mount(() =>
          Errored({
            fallback: (e: any) => <b>{e().message}</b>,
            children: function* () {
              return <>{yield* App()}</>;
            }
          })
        );
        flush();
        return root.textContent;
      };
      const Writes = component(function* Writes() {
        const [, setN] = yield* $signal(0);
        yield* $effect(
          // @ts-expect-error a Write is not a ComputeOp
          function* () {
            yield* setN(1);
          },
          function* () {}
        );
        return view(function* () {
          return <i />;
        });
      });
      expect(errorOf(Writes)).toMatch(/WRITE_IN_REACTIVE\] an effect's compute does not write/);
      // the effect phase reads, untracked because its host is (D-083)
      const Reads = component(function* Reads() {
        const [n] = yield* $signal(7);
        const [out, setOut] = yield* $signal(0);
        yield* $effect(
          function* () {},
          function* () {
            yield* setOut(yield* n);
          }
        );
        return view(function* () {
          return <i>{perform(out)}</i>;
        });
      });
      expect(errorOf(Reads)).toBe("7");
    }
  );

  devIt("an effect's undelegated receipt is UNYIELDED_WRITE", () => {
    const App = component(function* Effecting() {
      const [n, setN] = yield* $signal(0);
      yield* $effect(
        function* () {
          return yield* n;
        },
        function* (v) {
          if (v === 0) void setN(1);
        }
      );
      return view(function* () {
        return <i>{perform(n)}</i>;
      });
    });
    mount(() =>
      Errored({
        fallback: (e: any) => <b>{e().message}</b>,
        children: function* () {
          return <>{yield* App()}</>;
        }
      })
    );
    flush();
    expect(root.textContent).toMatch(/UNYIELDED_WRITE\] a \$signal's setter in <Effecting>/);
  });

  it("a receipt minted before an event's async attempt and delegated to after it is not unyielded", async () => {
    let go!: () => Promise<unknown>;
    const App = component(function* App() {
      const [n, setN] = yield* $signal(0);
      go = $event(function* () {
        const receipt = setN(7);
        yield* attempt(() => Promise.resolve(), toError);
        yield* receipt;
      });
      return view(function* () {
        return <i>{perform(n)}</i>;
      });
    });
    mount(App);
    await go();
    await settle();
    expect(root.textContent).toBe("7");
  });

  devIt("a setter called outside a routine is SETTER_OUTSIDE_RUN (D-028)", () => {
    let setter!: (v: number) => unknown;
    const App = component(function* App() {
      const [n, setN] = yield* $signal(0);
      setter = setN;
      return view(function* () {
        return <i>{perform(n)}</i>;
      });
    });
    mount(App);
    // handed to plain code (a DOM handler, a timer): it fails at the call
    expect(() => setter(1)).toThrow(
      /SETTER_OUTSIDE_RUN\] a \$signal's setter called outside a routine/
    );
  });

  it("$optimistic / $optimisticStore: an $event's writes show at once and revert when it settles", async () => {
    let resolve!: () => void;
    const App = component(function* () {
      const [saving, setSaving] = yield* $optimistic(false);
      const [list, setList] = yield* $optimisticStore({ items: ["a"] });
      const add = $event(function* () {
        yield* setSaving(true);
        yield* setList(s => {
          s.items.push("b");
        });
        yield* attempt(() => new Promise<void>(r => (resolve = r)), toError);
      });
      return view(function* () {
        return (
          <button onClick={yield* add}>
            {String(perform(saving))} {perform(readStore(list, s => s.items.join(",")))}
          </button>
        );
      });
    });
    mount(App);
    root.querySelector("button")!.click();
    flush();
    expect(root.textContent).toBe("true a,b");
    resolve();
    await settle();
    expect(root.textContent).toBe("false a");
  });

  devIt(
    "$optimistic is the scalar form and $optimisticStore the object-or-body form (D-014)",
    () => {
      // each through a cast: both are type errors (type-tests "D-014")
      const Body = component(function* () {
        const [v] = yield* $optimistic(function* () {
          return 1;
        } as unknown as number);
        return view(function* () {
          return <i>{perform(v)}</i>;
        });
      });
      expect(() => createRoot(() => Body())).toThrow(
        /OPTIMISTIC_FORM.*\$optimisticStore\(function\*/
      );
      const Scalar = component(function* () {
        const [s] = yield* $optimisticStore(1 as unknown as { n: number });
        return view(function* () {
          return <i>{perform(s.n)}</i>;
        });
      });
      expect(() => createRoot(() => Scalar())).toThrow(/OPTIMISTIC_FORM.*\$optimistic\(value\)/);
    }
  );

  it("a derived $optimisticStore waits on its body; refresh recomputes it", async () => {
    let calls = 0;
    let reload!: () => void;
    const App = component(function* () {
      const [todos] = yield* $optimisticStore(function* () {
        const n = ++calls;
        return yield* attempt(() => Promise.resolve([`t${n}`]), toError);
      }, [] as string[]);
      const again = $event(function* () {
        yield* refresh(todos);
      });
      reload = () => void again();
      return view(function* () {
        return <i>{perform(readStore(todos, t => t.join(",")))}</i>;
      });
    });
    mount(() =>
      Loading({
        fallback: function* () {
          return <b>wait</b>;
        },
        children: function* () {
          return <>{yield* App()}</>;
        }
      })
    );
    expect(root.textContent).toBe("wait");
    await settle();
    expect(root.textContent).toBe("t1");
    reload();
    await settle();
    expect(root.textContent).toBe("t2");
  });

  it("$projection derives a store from routine reads", () => {
    let setN!: (v: number) => void;
    const App = component(function* () {
      const [n, set] = yield* $signal(1);
      setN = v => write(() => set(v));
      const projected = yield* $projection(
        function* (draft: { doubled: number }) {
          draft.doubled = (yield* n) * 2;
        },
        { doubled: 0 }
      );
      return view(function* () {
        return <i>{perform(projected.doubled)}</i>;
      });
    });
    mount(App);
    expect(root.textContent).toBe("2");
    setN(4);
    flush();
    expect(root.textContent).toBe("8");
  });

  it("until waits in an $event until a source reads truthy", async () => {
    let ready!: () => void;
    let done = false;
    const App = component(function* () {
      const [ok, setOk] = yield* $signal(false);
      ready = () => write(() => setOk(true));
      const go = $event(function* () {
        yield* until(ok, toError);
        done = true;
      });
      return view(function* () {
        return <button onClick={yield* go}>go</button>;
      });
    });
    mount(App);
    root.querySelector("button")!.click();
    await settle();
    expect(done).toBe(false);
    ready();
    await settle();
    expect(done).toBe(true);
  });
});

describe("constant (D-060)", () => {
  it("reads its value, never changes, needs no owner; a context of sources defaults to one", () => {
    // module level: no owner, no root
    const one = constant(1);
    expect([...(one as any)]).toEqual([]);
    expect(perform(one)).toBe(1);
    const Identity = createContext(constant<string | null>(null));
    let setMe!: (v: string) => void;
    const Who = component(function* Who() {
      const who = yield* Identity;
      return view(function* () {
        return <b>{perform(who) ?? "nobody"}</b>;
      });
    });
    const Provider = component(function* () {
      const [me, set] = yield* $signal<string | null>("ada");
      setMe = v => write(() => set(v));
      return view(function* () {
        return (
          <div>
            <Identity value={me}>{yield* Who()}</Identity>
            {yield* Who()}
          </div>
        );
      });
    });
    mount(Provider);
    // with a provider, its source; with none, the constant
    expect(root.textContent).toBe("adanobody");
    setMe("grace");
    flush();
    expect(root.textContent).toBe("gracenobody");
    expect(perform(one)).toBe(1);
  });
});

describe("context", () => {
  it("yield* Ctx reads a context in a setup", () => {
    const Theme = createContext<string>("light");
    const Child = component(function* () {
      const theme = yield* Theme;
      return view(function* () {
        return <i>{perform(theme)}</i>;
      });
    });
    mount(() => <Theme value="dark">{Child()}</Theme>);
    expect(root.textContent).toBe("dark");
  });

  describe("D-098: a context without a default is required", () => {
    const UserCtx = createContext<{ name: string }, "UserCtx">(undefined, { name: "UserCtx" });
    const Avatar = component(function* Avatar() {
      const user = yield* UserCtx;
      return view(function* () {
        return <b>{yield* user.name}</b>;
      });
    });

    devIt("read with no provider above: NO_PROVIDER at the read, naming the reader", () => {
      expect(() => createRoot(() => Avatar())).toThrow(
        /\[NO_PROVIDER\] <Avatar> reads the context UserCtx/
      );
      const Parent = component(function* Parent() {
        return view(function* () {
          return <div>{yield* Avatar()}</div>;
        });
      });
      expect(() => mount(Parent as any)).toThrow("[NO_PROVIDER]");
    });

    it("a requirement out of a hole prop: the provide around the holder's call gives it (D-098 amended)", () => {
      const Greeting = component(function* Greeting() {
        const user = yield* UserCtx;
        return view(function* () {
          return <p>hello {yield* user.name}</p>;
        });
      });
      const Layout = component(function* Layout(props: Props<{ children: YieldElement }>) {
        return view(function* () {
          return <main>{yield* props.children}</main>;
        });
      });
      const App = component(function* App() {
        return view(function* () {
          return (
            <>
              {
                yield* UserCtx.provide({
                  value: { name: "ada" },
                  children: function* () {
                    return (
                      <>
                        {
                          yield* Layout({
                            children: function* () {
                              return <>{yield* Greeting({})}</>;
                            }
                          })
                        }
                      </>
                    );
                  }
                })
              }
            </>
          );
        });
      });
      mount(App);
      expect(root.innerHTML).toBe("<main><p>hello ada</p></main>");
    });

    devIt("a provide in the reader's own view does not give its setup (Solid's own rule)", () => {
      const SelfProvider = component(function* SelfProvider() {
        const user = yield* UserCtx;
        return view(function* () {
          return (
            <>
              {
                yield* UserCtx.provide({
                  value: { name: "inner" },
                  children: function* () {
                    return <b>{yield* user.name}</b>;
                  }
                })
              }
            </>
          );
        });
      });
      expect(() => createRoot(() => SelfProvider())).toThrow("[NO_PROVIDER]");
    });

    it("the provided value flows: a value, a source (live), a hole; the nearest provider wins", () => {
      let set!: (name: string) => void;
      const App = component(function* App() {
        const [name, setName] = yield* $signal("ada");
        set = v => write(() => setName(v));
        return view(function* () {
          return (
            <>
              {
                yield* UserCtx.provide({
                  value: { name: "plain" },
                  children: function* () {
                    return (
                      <>
                        {yield* Avatar()}
                        {
                          yield* UserCtx.provide({
                            value: function* () {
                              return { name: (yield* name).toUpperCase() };
                            },
                            children: function* () {
                              return <>{yield* Avatar()}</>;
                            }
                          })
                        }
                      </>
                    );
                  }
                })
              }
            </>
          );
        });
      });
      mount(App);
      expect(root.textContent).toBe("plainADA");
      set("lin");
      flush();
      expect(root.textContent).toBe("plainLIN");
    });

    it("a source as the value: the reader's holes read it live, its setup ran once", () => {
      const NameCtx = createContext<Source<string>, "NameCtx">();
      let setups = 0;
      let set!: (name: string) => void;
      const Reader = component(function* Reader() {
        setups++;
        const name = yield* NameCtx;
        return view(function* () {
          return <i>{yield* name}</i>;
        });
      });
      const App = component(function* App() {
        const [name, setName] = yield* $signal("a");
        set = v => write(() => setName(v));
        return view(function* () {
          return (
            <>
              {
                yield* NameCtx.provide({
                  value: name,
                  children: function* () {
                    return <>{yield* Reader()}</>;
                  }
                })
              }
            </>
          );
        });
      });
      mount(App);
      expect(root.textContent).toBe("a");
      set("b");
      flush();
      expect(root.textContent).toBe("b");
      expect(setups).toBe(1);
    });

    it("a defaulted context with no provider reads its default; a constant default too (D-060)", () => {
      const Theme = createContext("light");
      const Who = createContext(constant<string | null>(null));
      const Child = component(function* Child() {
        const theme = yield* Theme;
        const who = yield* Who;
        return view(function* () {
          return (
            <i>
              {yield* theme}/{String(yield* who)}
            </i>
          );
        });
      });
      mount(Child);
      expect(root.textContent).toBe("light/null");
    });
  });
});

describe("events", () => {
  it("$event is an action: its writes are one transaction across an async attempt", async () => {
    let resolve!: () => void;
    const App = component(function* () {
      const [n, setN] = yield* $signal(0);
      const [status, setStatus] = yield* $signal("idle");
      const click = $event(function* () {
        const v = yield* n;
        yield* setN(v + 1);
        yield* setStatus("saving");
        yield* attempt(() => new Promise<void>(r => (resolve = r)), toError);
        yield* setStatus("saved");
      });
      return view(function* () {
        return (
          <button onClick={yield* click}>
            {perform(n)} {perform(status)}
          </button>
        );
      });
    });
    mount(App);
    root.querySelector("button")!.click();
    flush();
    // held by the transaction: nothing the handler wrote shows while it waits
    expect(root.textContent).toBe("0 idle");
    resolve();
    await settle();
    expect(root.textContent).toBe("1 saved");
  });

  it("$event takes arguments, returns its result, and throws a rejection at the yield*", async () => {
    class SaveError extends Error {
      readonly kind = "save" as const;
    }
    const after: string[] = [];
    const save = $event(function* (id: string, times: number, fail: boolean) {
      yield* attempt(
        () => (fail ? Promise.reject(new SaveError(id)) : Promise.resolve()),
        e => e as SaveError
      );
      after.push(id);
      return id.repeat(times);
    });
    expect(await save("a", 3, false)).toBe("aaa");
    // thrown at the yield*: the body stops there, and the call fails with it
    await expect(save("b", 1, true)).rejects.toThrow(SaveError);
    expect(after).toEqual(["a"]);
  });

  it("a failure the caller handles goes to the caller, not to the Errored", async () => {
    let caught: unknown;
    let save!: () => Promise<unknown>;
    const App = component(function* () {
      const failing = $event(function* () {
        yield* raise(new Failed("declined"));
      });
      save = () => failing().catch(e => (caught = e));
      return view(function* () {
        return <p>ok</p>;
      });
    });
    mount(() =>
      Errored({
        fallback: (e: any) => <p>failed: {e().message}</p>,
        children: function* () {
          return <>{yield* App()}</>;
        }
      })
    );
    await save();
    await settle();
    expect((caught as Error).message).toBe("declined");
    expect(root.textContent).toBe("ok");
  });

  it("an event that reads a pending source waits for its data", async () => {
    let resolve!: (v: number) => void;
    let seen: number | undefined;
    let go!: () => unknown;
    const App = component(function* () {
      const data = yield* $memo(function* () {
        return yield* attempt(() => new Promise<number>(r => (resolve = r)), toError);
      });
      const take = $event(function* () {
        seen = yield* data;
      });
      go = () => take();
      return view(function* () {
        return <p>ok</p>;
      });
    });
    mount(App);
    go();
    await settle();
    expect(seen).toBe(undefined);
    resolve(7);
    await settle();
    expect(seen).toBe(7);
  });

  it("yield* a call of another event waits for it, returns its result, and throws its failure", async () => {
    let resolve!: (v: number) => void;
    const log: string[] = [];
    const fetchN = $event(function* () {
      return yield* attempt(() => new Promise<number>(r => (resolve = r)), toError);
    });
    const fail = $event(function* () {
      yield* raise(new Failed("no"));
    });
    const outer = $event(function* () {
      const n = yield* fetchN();
      log.push(`got ${n}`);
      // its failure, thrown at the delegation, handled by an attempt over the call (D-077)
      yield* attempt(
        () => fail(),
        e => {
          log.push(e.message);
        }
      );
    });
    const done = outer();
    await settle();
    expect(log).toEqual([]);
    resolve(3);
    await done;
    expect(log).toEqual(["got 3", "no"]);
  });

  it("an $effect delegates to a synchronous event call", () => {
    const seen: number[] = [];
    let setN!: (v: number) => void;
    const record = $event(function* (v: number) {
      seen.push(v);
    });
    const App = component(function* () {
      const [n, set] = yield* $signal(1);
      setN = v => write(() => set(v));
      yield* $effect(
        function* () {
          return yield* n;
        },
        function* (v) {
          yield* record(v);
        }
      );
      return view(function* () {
        return <p />;
      });
    });
    mount(App);
    flush();
    setN(2);
    flush();
    expect(seen).toEqual([1, 2]);
  });

  it("a failing $event with no Errored rejects its promise", async () => {
    const fail = $event(function* () {
      yield* raise(new Failed("nope"));
    });
    await expect(fail()).rejects.toThrow("nope");
  });

  it("calls of an event are independent runs: typing fast, the last answer to arrive wins (D-064)", async () => {
    const pending: Record<string, (v: string) => void> = {};
    let search!: (q: string) => Promise<unknown>;
    const Box = component(function* Box() {
      const [results, setResults] = yield* $signal("");
      search = $event(function* (q: string) {
        const found = yield* attempt(() => new Promise<string>(r => (pending[q] = r)), toError);
        yield* setResults(found);
      });
      return view(function* () {
        return <p>{perform(results)}</p>;
      });
    });
    mount(Box);
    const calls = [search("s"), search("so"), search("sol")];
    // the answers arrive out of order: every run resumes and writes
    pending["sol"]("results for sol");
    await settle();
    pending["s"]("results for s");
    pending["so"]("results for so");
    await settle();
    await Promise.all(calls);
    expect(root.textContent).toBe("results for so");
  });

  it("a failing view with no Errored re-throws (D-033)", () => {
    const Fails = component(function* Fails() {
      const m = yield* $memo(function* () {
        yield* raise(new Failed("no boundary"));
        return 1;
      });
      return view(function* () {
        return <i>{perform(m)}</i>;
      });
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let thrown: unknown;
    try {
      mount(Fails);
    } catch (e) {
      thrown = e;
    }
    error.mockRestore();
    // no boundary installed by the library: the failure is re-thrown
    expect(String(thrown)).toMatch(/no boundary/);
    expect(root.querySelector("i")).toBe(null);
  });

  it("a failing $event goes to the nearest Errored", async () => {
    class SaveError extends Error {
      readonly kind = "save" as const;
    }
    const App = component(function* () {
      const click = $event(function* () {
        yield* raise(new SaveError("nope"));
      });
      return view(function* () {
        return <button onClick={yield* click}>go</button>;
      });
    });
    mount(() =>
      Errored({
        fallback: (e: any) => <p>failed: {e().message}</p>,
        children: function* () {
          return <>{yield* App()}</>;
        }
      })
    );
    root.querySelector("button")!.click();
    await settle();
    expect(root.textContent).toBe("failed: nope");
  });

  it("an Errored with catch handles the error types it lists", () => {
    class NotFound extends Error {
      readonly kind = "not-found";
    }
    const Fails = component(function* () {
      const m = yield* $memo(function* () {
        yield* raise(new NotFound("nf"));
        return 1;
      });
      return view(function* () {
        return <i>{perform(m)}</i>;
      });
    });
    mount(() =>
      Errored({
        fallback: (e: any) => <p>outer: {e().message}</p>,
        children: function* () {
          return (
            <>
              {
                yield* Errored({
                  catch: [NotFound],
                  fallback: (e: any) => <p>inner: {e().message}</p>,
                  children: function* () {
                    return <>{yield* Fails()}</>;
                  }
                })
              }
            </>
          );
        }
      })
    );
    expect(root.textContent).toBe("inner: nf");
  });

  it("an Errored with catch rethrows any other error to the boundary above", () => {
    class NotFound extends Error {
      readonly kind = "not-found";
    }
    class Forbidden extends Error {
      readonly kind = "forbidden";
    }
    const Fails = component(function* () {
      const m = yield* $memo(function* () {
        yield* raise(new Forbidden("no"));
        return 1;
      });
      return view(function* () {
        return <i>{perform(m)}</i>;
      });
    });
    mount(() =>
      Errored({
        fallback: (e: any) => <p>outer: {e().message}</p>,
        children: function* () {
          return (
            <>
              {
                yield* Errored({
                  catch: [NotFound],
                  fallback: (e: any) => <p>inner: {e().message}</p>,
                  children: function* () {
                    return <>{yield* Fails()}</>;
                  }
                })
              }
            </>
          );
        }
      })
    );
    expect(root.textContent).toBe("outer: no");
  });

  it("a body's attempt types a returned promise's failure", async () => {
    class LoadError extends Error {
      readonly kind = "load";
    }
    const Loads = component(function* () {
      const m = yield* $memo(function* () {
        return yield* attempt(
          () => Promise.reject(new Error("boom")),
          e => new LoadError((e as Error).message)
        );
      });
      return view(function* () {
        return <i>{perform(m)}</i>;
      });
    });
    mount(() =>
      Errored({
        fallback: (e: any) => (
          <p>
            {e() instanceof LoadError ? "load" : "other"}: {e().message}
          </p>
        ),
        children: function* () {
          return (
            <>
              {
                yield* Loading({
                  children: function* () {
                    return <>{yield* Loads()}</>;
                  }
                })
              }
            </>
          );
        }
      })
    );
    await settle();
    expect(root.textContent).toBe("load: boom");
  });

  it("a body's attempt gives back a stream whose failures it types", async () => {
    class StreamError extends Error {
      readonly kind = "stream";
    }
    const Streams = component(function* () {
      const m = yield* $memo(function* () {
        return yield* attempt(
          () =>
            (async function* () {
              yield 1;
              throw new Error("cut");
            })(),
          e => new StreamError((e as Error).message)
        );
      });
      return view(function* () {
        return <i>{perform(m)}</i>;
      });
    });
    mount(() =>
      Errored({
        fallback: (e: any) => (
          <p>
            {e() instanceof StreamError ? "stream" : "other"}: {e().message}
          </p>
        ),
        children: function* () {
          return (
            <>
              {
                yield* Loading({
                  children: function* () {
                    return <>{yield* Streams()}</>;
                  }
                })
              }
            </>
          );
        }
      })
    );
    await settle(6);
    expect(root.textContent).toBe("stream: cut");
  });

  devIt("an $event does not attempt a stream: STREAM_IN_EVENT (D-091)", async () => {
    async function* feed() {
      yield 1;
    }
    // the types refuse it (a stream attempt is not an EventOp): cast past them
    const save = $event(function* () {
      return yield* attempt(
        () => feed(),
        () => {}
      );
    } as any);
    await expect(save()).rejects.toThrow(/STREAM_IN_EVENT/);
  });

  it("a stream attempt's handler is a plain function: a generator handler fails the stream with STREAM_HANDLER (D-091)", async () => {
    async function* feed() {
      yield 1;
      throw new Error("dropped");
    }
    const got: unknown[] = [];
    let ran = false;
    const App = component(function* () {
      yield* $effect(
        function* () {},
        function* () {
          // the types refuse a generator handler on a stream: cast past them
          const stream = yield* attempt(() => feed(), function* () {
            ran = true;
          } as any);
          void (async () => {
            try {
              for await (const v of stream as AsyncIterable<number>) got.push(v);
            } catch (e) {
              got.push(e);
            }
          })();
        }
      );
      return view(function* () {
        return <i>ok</i>;
      });
    });
    mount(App);
    await settle();
    expect(got[0]).toBe(1);
    expect(String(got[1])).toMatch(/STREAM_HANDLER/);
    // the generator was closed, not run
    expect(ran).toBe(false);
  });

  it("a memo's raise reaches Errored", () => {
    class Missing extends Error {
      readonly kind = "missing" as const;
    }
    const App = component(function* () {
      const m = yield* $memo(function* () {
        yield* raise(new Missing("missing"));
        return 1;
      });
      return view(function* () {
        return <i>{perform(m)}</i>;
      });
    });
    mount(() =>
      Errored({
        fallback: (e: any) => <p>{e().message}</p>,
        children: function* () {
          return <>{yield* App()}</>;
        }
      })
    );
    expect(root.textContent).toBe("missing");
  });
});

describe("row routines", () => {
  it("an in-place item change updates the row without re-creating it (D-055)", () => {
    let edit!: (text: string) => void;
    let setups = 0;
    let views = 0;
    const List = component(function* List() {
      const [store, setStore] = yield* $store({ items: [{ text: "a" }, { text: "b" }] });
      edit = text =>
        write(() =>
          setStore(s => {
            s.items[0].text = text;
          })
        );
      return view(function* () {
        return (
          <ul>
            {
              yield* For({
                each: store.items,
                children: function* (item, index) {
                  setups++;
                  return view(function* () {
                    views++;
                    return (
                      <li>
                        {perform(index)}:{perform(item.text)}
                      </li>
                    );
                  });
                }
              })
            }
          </ul>
        );
      });
    });
    mount(List);
    const first = root.querySelector("li")!;
    expect(root.textContent).toBe("0:a1:b");
    edit("A");
    flush();
    expect(root.textContent).toBe("0:A1:b");
    // the same row, its setup and view run once: only the hole re-ran
    expect(root.querySelector("li")).toBe(first);
    expect(setups).toBe(2);
    expect(views).toBe(2);
  });

  it("a row memo is created once per item", () => {
    let setItems!: (v: { id: number; text: string }[]) => void;
    let setText!: (v: string) => void;
    const created: number[] = [];
    const computed: string[] = [];
    const a = { id: 1, text: "a" };
    const b = { id: 2, text: "b" };
    const List = component(function* () {
      const [items, set] = yield* $signal([a, b]);
      const [suffix, setSuffix] = yield* $signal("!");
      setItems = v => write(() => set(v));
      setText = v => write(() => setSuffix(v));
      return view(function* () {
        return (
          <ul>
            {
              yield* For({
                each: items,
                children: function* (item) {
                  // the row's body is a setup: it runs once per item, and the
                  // memo it creates is the row's (read by two holes, computed once)
                  yield* $effect(
                    function* () {},
                    function* () {
                      created.push(yield* item.id);
                    }
                  );
                  const label = yield* $memo(function* () {
                    const text = `${yield* item.text}${yield* suffix}`;
                    computed.push(text);
                    return text;
                  });
                  return view(function* () {
                    return <li title={perform(label)}>{perform(label)}</li>;
                  });
                }
              })
            }
          </ul>
        );
      });
    });
    mount(List);
    const lis = () => [...root.querySelectorAll("li")];
    expect(lis().map(l => l.textContent)).toEqual(["a!", "b!"]);
    expect(created).toEqual([1, 2]);
    expect(computed).toEqual(["a!", "b!"]);
    const [first] = lis();
    // a new item creates its row (and its memo); the others keep theirs
    setItems([a, b, { id: 3, text: "c" }]);
    flush();
    expect(lis().map(l => l.textContent)).toEqual(["a!", "b!", "c!"]);
    expect(lis()[0]).toBe(first);
    expect(created).toEqual([1, 2, 3]);
    // a change the memos read recomputes each once; no row is created again
    computed.length = 0;
    setText("?");
    flush();
    expect(lis().map(l => l.title)).toEqual(["a?", "b?", "c?"]);
    expect(computed).toEqual(["a?", "b?", "c?"]);
    expect(created).toEqual([1, 2, 3]);
  });

  it("a row's raise reaches the Errored above the list, or re-throws with none (D-059)", () => {
    let setItems!: (v: string[]) => void;
    const row = function* (item: any) {
      const shown = yield* $memo(function* () {
        const v: string = yield* item;
        if (v === "bad") yield* raise(new Failed(`row ${v}`));
        return v;
      });
      return view(function* () {
        return <li>{perform(shown)}</li>;
      });
    };
    const List = component(function* List() {
      const [items, set] = yield* $signal(["a", "b"]);
      setItems = v => write(() => set(v));
      return view(function* () {
        return <ul>{perform(For({ each: items, children: row }))}</ul>;
      });
    });
    mount(() =>
      Errored({
        fallback: (e: any) => <p>{e().message}</p>,
        children: function* () {
          return <>{yield* List()}</>;
        }
      })
    );
    expect(root.textContent).toBe("ab");
    setItems(["a", "bad"]);
    flush();
    expect(root.textContent).toBe("row bad");
    dispose?.();
    root.textContent = "";
    // with no boundary the failure is re-thrown at the root (D-033)
    const Bare = component(function* Bare() {
      return view(function* () {
        return <ul>{perform(For({ each: ["bad"], children: row }))}</ul>;
      });
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let thrown: unknown;
    try {
      mount(Bare);
    } catch (e) {
      thrown = e;
    }
    error.mockRestore();
    expect(String(thrown)).toMatch(/row bad/);
  });

  it("a pending row reaches the Loading above the list (D-063)", async () => {
    let resolve!: (v: string) => void;
    const row = function* (item: any) {
      const shown = yield* $memo(function* () {
        const v: string = yield* item;
        if (v !== "slow") return v;
        return yield* attempt(() => new Promise<string>(r => (resolve = r)), toError);
      });
      return view(function* () {
        return <li>{perform(shown)}</li>;
      });
    };
    const List = component(function* List() {
      return view(function* () {
        return <ul>{perform(For({ each: ["a", "slow"], children: row }))}</ul>;
      });
    });
    mount(() =>
      Loading({
        fallback: function* () {
          return <i>loading</i>;
        },
        children: function* () {
          return <>{yield* List()}</>;
        }
      })
    );
    expect(root.textContent).toBe("loading");
    resolve("done");
    await settle();
    expect(root.textContent).toBe("adone");
  });

  devIt("a row's body returns its view, as a setup does", () => {
    const Rows = component(function* () {
      return view(function* () {
        return (
          <ul>
            {
              yield* For({
                each: [1],
                // a row that returns its markup directly (no view): a dev error
                children: function* (_item: unknown) {
                  return <li />;
                } as unknown as (item: unknown) => Generator<never, ViewFn<never, null>>
              })
            }
          </ul>
        );
      });
    });
    expect(() => createRoot(() => Rows())).toThrow(/ROW_VIEW/);
  });

  it("per-row state in a For; updating the list keeps rows (issue: views re-rendered on re-walk)", () => {
    let setItems!: (v: { id: number; text: string }[]) => void;
    let setups = 0;
    let views = 0;
    const List = component(function* () {
      const [items, set] = yield* $signal([
        { id: 1, text: "a" },
        { id: 2, text: "b" }
      ]);
      setItems = v => write(() => set(v));
      return view(function* () {
        return (
          <ul>
            {
              yield* For({
                each: items,
                children: function* (item) {
                  setups++;
                  const [open, setOpen] = yield* $signal(false);
                  const toggle = $event(function* () {
                    yield* setOpen(o => !o);
                  });
                  return view(function* () {
                    views++;
                    return (
                      <li onClick={yield* toggle}>
                        {perform(item.text)} {perform(open) ? "[-]" : "[+]"}
                      </li>
                    );
                  });
                }
              })
            }
          </ul>
        );
      });
    });
    mount(List);
    const first = root.querySelector("li")!;
    first.click();
    flush();
    expect(root.textContent).toBe("a [-]b [+]");
    setItems([
      { id: 0, text: "z" },
      ...[...root.querySelectorAll("li")].map((_, i) => ({ id: i + 1, text: "ab"[i] }))
    ]);
    flush();
    // Keyed by reference: new objects are new rows; the state belongs to the row.
    expect(root.querySelectorAll("li").length).toBe(3);
    expect(setups).toBe(5);
    expect(views).toBe(5);
  });

  it("rows survive re-reads of the For output (same objects)", () => {
    const rows = [{ t: "a" }, { t: "b" }];
    let set!: (v: typeof rows) => void;
    let views = 0;
    const Row = component(function* (props: Props<{ row: { t: string } }>) {
      const [n] = yield* $signal(0);
      return view(function* () {
        views++;
        return (
          <li>
            {perform(props.row.t)}
            {perform(n)}
          </li>
        );
      });
    });
    const App = component(function* () {
      const [items, setItems] = yield* $signal(rows);
      set = v => write(() => setItems(v));
      return view(function* () {
        return (
          <ul>
            {
              yield* For({
                each: items,
                children: function* (row) {
                  return view(function* () {
                    return <>{yield* Row({ row: row })}</>;
                  });
                }
              })
            }
          </ul>
        );
      });
    });
    mount(App);
    const lis = [...root.querySelectorAll("li")];
    set([...rows, { t: "c" }]);
    flush();
    set([...rows].reverse());
    flush();
    const after = [...root.querySelectorAll("li")];
    expect(after[1]).toBe(lis[0]);
    expect(after[0]).toBe(lis[1]);
    expect(views).toBe(3);
  });

  it("named recursive row routines, bare function* rows, Show / Match / Repeat branches", () => {
    type C = { id: number; kids: C[] };
    const tree: C[] = [{ id: 1, kids: [{ id: 2, kids: [] }] }];
    const Thread = component(function* () {
      // recursive: its view's yields are spelled out
      function* comment(c: any) {
        const [open] = yield* $signal(true);
        return view(function* (): Generator<ChildView<boolean, any>, YieldElement> {
          return (
            <li>
              {perform(c.id)}
              {
                yield* Show({
                  when: open,
                  children: function* () {
                    return (
                      <ul>
                        {
                          yield* For({
                            each: c.kids,
                            children: comment
                          })
                        }
                      </ul>
                    );
                  }
                })
              }
            </li>
          );
        });
      }
      return view(function* () {
        return (
          <>
            {
              yield* For({
                each: tree,
                children: comment
              })
            }
          </>
        );
      });
    });
    mount(Thread);
    expect(root.querySelectorAll("li").length).toBe(2);
    dispose!();
    root.textContent = "";

    const [when, setWhen] = plainSignal<{ name: string } | undefined>({ name: "x" });
    const App = component(function* () {
      return view(function* () {
        return (
          <div>
            {
              yield* Show({
                when: function* () {
                  return when();
                },
                keyed: true,
                children: function* (v: any) {
                  const [k] = yield* $signal("!");
                  return view(function* () {
                    return (
                      <b>
                        {perform(v.name)}
                        {perform(k)}
                      </b>
                    );
                  });
                }
              })
            }
            {
              yield* Switch({
                children: function* () {
                  return (
                    <>
                      {
                        yield* Match({
                          when: function* () {
                            return when();
                          },
                          children: function* (v: any) {
                            return view(function* () {
                              return <s>{perform(v.name)}</s>;
                            });
                          }
                        })
                      }
                    </>
                  );
                }
              })
            }
            {
              yield* Repeat({
                count: 2,
                children: function* (i) {
                  const [x] = yield* $signal(10);
                  return view(function* () {
                    return <u>{perform(i) + perform(x)}</u>;
                  });
                }
              })
            }
          </div>
        );
      });
    });
    mount(App);
    expect(root.querySelector("b")!.textContent).toBe("x!");
    expect(root.querySelector("s")!.textContent).toBe("x");
    expect([...root.querySelectorAll("u")].map(u => u.textContent)).toEqual(["10", "11"]);
    setWhen({ name: "y" });
    flush();
    expect(root.querySelector("b")!.textContent).toBe("y!");
    expect(root.querySelector("s")!.textContent).toBe("y");
  });

  it("a Show's direct child view is not rebuilt when the Show re-reads", () => {
    let views = 0;
    const [flag, setFlag] = plainSignal(1);
    const Child = component(function* () {
      return view(function* () {
        views++;
        return <i>child</i>;
      });
    });
    mount(() =>
      Show({
        when: function* () {
          return flag();
        },
        children: function* () {
          return <>{yield* Child()}</>;
        }
      })
    );
    const i = root.querySelector("i");
    setFlag(2);
    flush();
    setFlag(3);
    flush();
    expect(root.querySelector("i")).toBe(i);
    expect(views).toBe(1);
  });
});

describe("reads from JSX positions are never a view's or a setup's own", () => {
  it("plain Solid code reading a prop getter untracked while a child view is built (Reveal registering a Loading)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let resolve!: (v: string) => void;
    let cardViews = 0;
    const Card = component(function* () {
      const v = yield* $memo(function* () {
        return yield* attempt(() => new Promise<string>(r => (resolve = r)), toError);
      });
      return view(function* () {
        cardViews++;
        return (
          <>
            {
              yield* Loading({
                fallback: function* () {
                  return <i>loading</i>;
                },
                children: function* () {
                  return <b>{perform(v)}</b>;
                }
              })
            }
          </>
        );
      });
    });
    // a plain component that reads its prop untracked when it is created
    let seen: unknown;
    const Probe = (props: { value: unknown; children: unknown }) => {
      seen = untrack(() => props.value);
      return props.children as never;
    };
    const Page = component(function* () {
      const [order] = yield* $signal<"sequential" | "together">("sequential");
      const [label] = yield* $signal("x");
      return view(function* () {
        return (
          <div>
            <Probe value={perform(label)}>{yield* Card()}</Probe>
            <Reveal order={perform(order)}>
              {yield* Card()}
              {yield* Card()}
            </Reveal>
          </div>
        );
      });
    });
    mount(Page);
    expect(seen).toBe("x");
    expect(root.textContent).toBe("loadingloadingloading");
    resolve("done");
    await settle();
    expect(warn.mock.calls.some(c => String(c[0]).includes("VIEW_READS_OUTSIDE_JSX"))).toBe(false);
    expect(cardViews).toBe(3);
    warn.mockRestore();
  });
});

describe("a view that is a function is a branch's content", () => {
  it("Show / Match render it (a lazy page's output) instead of calling it as a render callback", async () => {
    const [n, setN] = plainSignal(1);
    const Whole = component(function* (props: Props<{ n: number }>) {
      return view(function* () {
        return <b>{perform(props.n)}</b>;
      });
    });
    // a lazy component's output is a function (its memo), marked as a view
    const Page = lazy(() => Promise.resolve({ default: Whole }));
    const [on, setOn] = plainSignal<string | false>("a");
    const nProps = {
      get n() {
        return n();
      }
    };
    mount(() => (
      <div>
        {Show({
          when: function* () {
            return on();
          },
          children: function* () {
            return <>{yield* Whole(nProps)}</>;
          }
        })}
        {Switch({
          children: function* () {
            return (
              <>
                {
                  yield* Match({
                    when: function* () {
                      return on();
                    },
                    children: function* () {
                      return <>{perform(Page(nProps))}</>;
                    }
                  })
                }
              </>
            );
          }
        })}
      </div>
    ));
    await settle();
    expect(root.textContent).toBe("11");
    setN(2);
    flush();
    expect(root.textContent).toBe("22");
    // a new truthy value re-reads the branch: still content, still one view
    setOn("b");
    flush();
    expect(root.textContent).toBe("22");
  });
});

describe("lazy", () => {
  it("a lazy yield component in call form is built once; its chunk and its state land in place", async () => {
    let setups = 0;
    let bump!: () => void;
    const Inner = component(function* (props: Props<{ label: string }>) {
      setups++;
      const [n, setN] = yield* $signal(1);
      bump = () => write(() => setN(v => v + 1));
      return view(function* () {
        return (
          <b>
            {perform(props.label)}
            {perform(n)}
          </b>
        );
      });
    });
    let land!: (m: { default: typeof Inner }) => void;
    const Page = lazy(() => new Promise<{ default: typeof Inner }>(r => (land = r)));
    let setLabel!: (v: string) => void;
    const App = component(function* () {
      const [label, set] = yield* $signal("n=");
      setLabel = v => write(() => set(v));
      return view(function* () {
        return <div>{perform(Page({ label }))}</div>;
      });
    });
    mount(() =>
      Loading({
        fallback: function* () {
          return <i>wait</i>;
        },
        children: function* () {
          return <>{yield* App()}</>;
        }
      })
    );
    expect(root.textContent).toBe("wait");
    land({ default: Inner });
    await settle();
    expect(root.textContent).toBe("n=1");
    bump();
    flush();
    setLabel("count ");
    flush();
    expect(root.textContent).toBe("count 2");
    expect(setups).toBe(1);
    // lazy's own properties are kept
    expect(typeof Page.preload).toBe("function");
  });
});

describe("flow controls keep children lazy", () => {
  it("a hole prop is read in the child, as a source is: a change updates the hole, the child is not re-created (D-065)", () => {
    let setups = 0;
    const Total = component(function* (props: Props<{ n: number }>) {
      setups++;
      return view(function* () {
        return <b>{yield* props.n}</b>;
      });
    });
    let set!: (v: number) => void;
    const App = component(function* () {
      const [n, setN] = yield* $signal(1);
      set = v => write(() => setN(v));
      return view(function* () {
        return (
          <p>
            {
              yield* Total({
                n: function* () {
                  return (yield* n) * 2;
                }
              })
            }
          </p>
        );
      });
    });
    const root = document.createElement("div");
    const dispose = render(App as any, root);
    flush();
    expect(root.textContent).toBe("2");
    set(5);
    flush();
    expect(root.textContent).toBe("10");
    expect(setups).toBe(1);
    dispose();
  });
  it("a fallback written as a function* is a lazy view: its components set up when it shows (D-066)", () => {
    let setups = 0;
    const Late = component(function* () {
      setups++;
      return view(function* () {
        return <i>late</i>;
      });
    });
    let set!: (v: boolean) => void;
    const App = component(function* () {
      const [on, setOn] = yield* $signal(true);
      set = v => write(() => setOn(v));
      return view(function* () {
        return (
          <>
            {
              yield* Show({
                when: on,
                fallback: function* () {
                  return <>{yield* Late()}</>;
                },
                children: function* () {
                  return <b>on</b>;
                }
              })
            }
          </>
        );
      });
    });
    const root = document.createElement("div");
    const dispose = render(App as any, root);
    flush();
    expect(root.textContent).toBe("on");
    expect(setups).toBe(0);
    set(false);
    flush();
    expect(root.textContent).toBe("late");
    expect(setups).toBe(1);
    dispose();
  });
  it("Errored's fallback written as a function* is a lazy view, as other flow controls' (D-066)", () => {
    let setups = 0;
    const Oops = component(function* () {
      setups++;
      return view(function* () {
        return <i>oops</i>;
      });
    });
    let set!: (v: boolean) => void;
    const App = component(function* () {
      const [bad, setBad] = yield* $signal(false);
      set = v => write(() => setBad(v));
      const value = yield* $memo(function* () {
        if (yield* bad) yield* raise(new Failed("bad"));
        return "ok";
      });
      return view(function* () {
        return (
          <>
            {
              yield* Errored({
                fallback: function* () {
                  return <>{yield* Oops()}</>;
                },
                children: function* () {
                  return <b>{yield* value}</b>;
                }
              })
            }
          </>
        );
      });
    });
    const root = document.createElement("div");
    const dispose = render(App as any, root);
    flush();
    expect(root.textContent).toBe("ok");
    expect(setups).toBe(0);
    set(true);
    flush();
    expect(root.textContent).toBe("oops");
    expect(setups).toBe(1);
    dispose();
  });
  it("element children are built when (and each time) the branch shows", () => {
    let built = 0;
    const node = document.createElement("b");
    const [which, setWhich] = plainSignal("a");
    const App = component(function* () {
      const make = (label: string) => {
        built++;
        return <i>{label}</i>;
      };
      return view(function* () {
        return (
          <div>
            {
              yield* Show({
                when: which() === "a",
                children: function* () {
                  return <p>{node}</p>;
                }
              })
            }
            {
              yield* Show({
                when: which() === "b",
                children: function* () {
                  return <s>{node}</s>;
                }
              })
            }
            {
              yield* Show({
                when: which() === "c",
                children: function* () {
                  return <>{make("c")}</>;
                }
              })
            }
          </div>
        );
      });
    });
    mount(App);
    // the shared node sits in the branch that shows (built lazily, not by
    // every Show at creation)
    expect(root.querySelector("p")!.firstChild).toBe(node);
    expect(built).toBe(0);
    setWhich("b");
    flush();
    expect(root.querySelector("s")!.firstChild).toBe(node);
    setWhich("c");
    flush();
    expect(built).toBe(1);
    expect(root.textContent).toBe("c");
  });
});

describe("computations created in a setup", () => {
  it("read sources in their own pass (their reads are theirs, not the setup's)", () => {
    const Child = component(function* (props: Props<{ n: number }>) {
      const m = yield* $memo(function* () {
        return (yield* props.n) * 2;
      });
      return view(function* () {
        return <b>{yield* m}</b>;
      });
    });
    const [n, setN] = plainSignal(2);
    // a plain Solid signal given as a hole: read inside the child (D-065)
    mount(() =>
      Child({
        n: function* () {
          return n();
        }
      })
    );
    expect(root.textContent).toBe("4");
    setN(3);
    flush();
    expect(root.textContent).toBe("6");
  });

  devIt("the setup's own read is still an error", () => {
    const Child = component(function* (props: Props<{ n: number }>) {
      yield* props.n as unknown as Iterable<never>;
      return view(function* () {
        return <b />;
      });
    });
    expect(() => createRoot(() => Child({ n: 1 }))).toThrow("[READ_IN_SETUP]");
  });
});

describe("D-097: a component runs in its caller's computation (no untrack)", () => {
  it("a setup runs exactly once per instance, and its own reads never re-run the hole that created it", () => {
    let setups = 0;
    let holeRuns = 0;
    let effects = 0;
    const [n, setN] = plainSignal(1);
    const Foreign = (props: { value: number }) => <u>{props.value}</u>;
    const Child = component(function* Child(props: Props<{ n: number; label: string }>) {
      setups++;
      const doubled = yield* $memo(function* () {
        return (yield* props.n) * 2;
      });
      yield* $effect(
        function* () {
          return yield* props.n;
        },
        function* () {
          effects++;
        }
      );
      const [items] = yield* $store([{ id: 1 }, { id: 2 }]);
      return view(function* () {
        return (
          <p>
            {perform(props.label)}:{perform(doubled)}
            {perform(
              Show({
                when: function* () {
                  return (yield* props.n) > 1;
                },
                children: function* () {
                  return <s>big</s>;
                }
              })
            )}
            {perform(
              For({
                each: items,
                children: function* (item: any) {
                  return view(function* () {
                    return <i>{perform(item.id)}</i>;
                  });
                }
              })
            )}
            <Foreign value={perform(props.n)} />
          </p>
        );
      });
    });
    const nHole = function* () {
      return n();
    };
    const Parent = component(function* Parent() {
      return view(function* () {
        return (
          <div>
            {perform((holeRuns++, Child({ n: nHole, label: "a" })))}
            {perform(Child({ n: nHole, label: "b" }))}
          </div>
        );
      });
    });
    mount(Parent);
    expect(root.textContent).toBe("a:2121b:2121");
    expect([setups, holeRuns, effects]).toEqual([2, 1, 2]);
    setN(2);
    flush();
    expect(root.textContent).toBe("a:4big122b:4big122");
    // each child's memo, effect, Show, row and foreign prop re-ran; the
    // child's setup and the parent's hole did not
    expect([setups, holeRuns, effects]).toEqual([2, 1, 4]);
  });

  devIt(
    "a read in a setup called inside a hole is still READ_IN_SETUP (the hole's observer is the setup's)",
    () => {
      const Bad = component(function* Bad(props: Props<{ n: number }>) {
        yield* props.n as unknown as Iterable<never>;
        return view(function* () {
          return <b />;
        });
      });
      const Parent = component(function* Parent() {
        return view(function* () {
          return <div>{perform(Bad({ n: 1 }))}</div>;
        });
      });
      expect(() => mount(Parent)).toThrow("[READ_IN_SETUP]");
    }
  );

  devIt("a read at a view's top level inside a hole is still READ_IN_VIEW", () => {
    const [n] = plainSignal(1);
    const Bad = component(function* Bad() {
      const s = yield* $memo(function* () {
        return n();
      });
      return view(function* () {
        const v = yield* s;
        return <b>{v}</b>;
      });
    });
    const Parent = component(function* Parent() {
      return view(function* () {
        return <div>{perform(Bad())}</div>;
      });
    });
    expect(() => mount(Parent)).toThrow(/READ_IN_VIEW.*<Bad>/);
  });
});

describe("Loading on a source", () => {
  it("the call form's `on` may be a source: a new key shows the fallback", async () => {
    let setKey!: (v: string) => void;
    const resolvers: Record<string, (v: string) => void> = {};
    const Page = component(function* () {
      const [k, set] = yield* $signal("a");
      setKey = v => write(() => set(v));
      const v = yield* $memo(function* () {
        const at = yield* k;
        return yield* attempt(() => new Promise<string>(r => (resolvers[at] = r)), toError);
      });
      const Content = component(function* () {
        return view(function* () {
          return <b>{perform(v)}</b>;
        });
      });
      return view(function* () {
        return (
          <div>
            {perform(
              Loading({
                on: k,
                fallback: function* () {
                  return <i>wait</i>;
                },
                children: function* () {
                  return <>{yield* Content()}</>;
                }
              })
            )}
          </div>
        );
      });
    });
    mount(Page);
    expect(root.textContent).toBe("wait");
    resolvers.a("A");
    await settle();
    expect(root.textContent).toBe("A");
    setKey("b");
    flush();
    // a different key is different content: the fallback, not the stale "A"
    expect(root.textContent).toBe("wait");
    resolvers.b("B");
    await settle();
    expect(root.textContent).toBe("B");
  });
});

describe("boundaries in call form", () => {
  // `<Loading>{X()}</Loading>` gets its children as a getter; the call form
  // gets what the caller built. A component called in the argument list is
  // built before the boundary exists — its pending reads would reach the
  // boundary above — so the call form takes its content as a function.
  function pendingView() {
    let resolve!: (v: string) => void;
    const Pending = component(function* () {
      const v = yield* $memo(function* () {
        return yield* attempt(() => new Promise<string>(r => (resolve = r)), toError);
      });
      return view(function* () {
        return <b>{perform(v)}</b>;
      });
    });
    return { Pending, resolve: (v: string) => resolve(v) };
  }

  it("Loading({ children: () => View }) builds the content inside the boundary", async () => {
    const { Pending, resolve } = pendingView();
    const Page = component(function* () {
      return view(function* () {
        return (
          <div>
            <p>shell</p>
            {perform(
              Loading({
                fallback: function* () {
                  return <i>inner</i>;
                },
                children: function* () {
                  return <>{yield* Pending()}</>;
                }
              })
            )}
          </div>
        );
      });
    });
    mount(() =>
      Loading({
        fallback: function* () {
          return <i>outer</i>;
        },
        children: function* () {
          return <>{yield* Page()}</>;
        }
      })
    );
    expect(root.textContent).toBe("shellinner");
    resolve("done");
    await settle();
    expect(root.textContent).toBe("shelldone");
  });

  it("Errored({ children: () => View }) too", async () => {
    const Failing = component(function* () {
      const v = yield* $memo(function* () {
        return yield* raise(new Failed("nope"));
      });
      return view(function* () {
        return <b>{perform(v)}</b>;
      });
    });
    const Page = component(function* () {
      return view(function* () {
        return (
          <div>
            {perform(
              Errored({
                fallback: (e: () => unknown) => <i>{String((e() as Error).message)}</i>,
                children: function* () {
                  return <>{yield* Failing()}</>;
                }
              })
            )}
          </div>
        );
      });
    });
    mount(() =>
      Errored({
        fallback: function* () {
          return <i>outer</i>;
        },
        children: function* () {
          return <>{yield* Page()}</>;
        }
      })
    );
    expect(root.textContent).toBe("nope");
  });

  devIt("content built before the boundary is a dev error", () => {
    const { Pending } = pendingView();
    expect(() =>
      createRoot(dispose => {
        try {
          // @ts-expect-error a built view is not content: the types refuse it too (D-094)
          Loading({ fallback: "…", children: Pending() });
        } finally {
          dispose();
        }
      })
    ).toThrow("[BOUNDARY_CONTENT_BUILT]");
  });
});

describe("flow controls take holes (D-038)", () => {
  it("Show / Match when, For each and Repeat count may be a bare function* hole", () => {
    let set!: (v: number) => void;
    const App = component(function* () {
      const [n, setN] = yield* $signal(1);
      set = v => write(() => setN(v));
      return view(function* () {
        return (
          <div>
            {
              yield* Show({
                when: function* () {
                  return (yield* n) > 1;
                },
                fallback: function* () {
                  return <i>small</i>;
                },
                children: function* () {
                  return <b>big</b>;
                }
              })
            }
            {
              yield* Switch({
                fallback: function* () {
                  return <s>odd</s>;
                },
                children: function* () {
                  return (
                    <>
                      {
                        yield* Match({
                          when: function* () {
                            return (yield* n) % 2 === 0;
                          },
                          children: function* () {
                            return <s>even</s>;
                          }
                        })
                      }
                    </>
                  );
                }
              })
            }
            {
              yield* For({
                each: function* () {
                  return ["a", "b", "c"].slice(0, yield* n);
                },
                children: function* (item) {
                  return view(function* () {
                    return <u>{perform(item)}</u>;
                  });
                }
              })
            }
            {
              yield* Repeat({
                count: function* () {
                  return yield* n;
                },
                children: function* (i) {
                  return view(function* () {
                    return <em>{perform(i)}</em>;
                  });
                }
              })
            }
          </div>
        );
      });
    });
    mount(App);
    expect(root.textContent).toBe("smallodda0");
    set(2);
    flush();
    expect(root.textContent).toBe("bigevenab01");
    set(3);
    flush();
    expect(root.textContent).toBe("bigoddabc012");
  });
});

describe("derivations", () => {
  it("a derivation several holes read is a $memo: it runs once per change", () => {
    let set!: (v: number) => void;
    let runs = 0;
    const App = component(function* () {
      const [n, setN] = yield* $signal(2);
      set = v => write(() => setN(v));
      const doubled = yield* $memo(function* () {
        runs++;
        return (yield* n) * 2;
      });
      const plusOne = yield* $memo(function* () {
        return (yield* doubled) + 1;
      });
      return view(function* () {
        return (
          <p>
            {perform(doubled)} {perform(plusOne)} {perform(doubled)}
          </p>
        );
      });
    });
    mount(App);
    expect(root.textContent).toBe("4 5 4");
    set(5);
    flush();
    expect(root.textContent).toBe("10 11 10");
    expect(runs).toBe(2);
  });
});

describe("untyped throws (D-019)", () => {
  /** What a fallback shows of a failure: its message. */
  const shown = (e: any) => <p>{String(e().message)}</p>;
  const throwIn = (where: string) => {
    throw new TypeError(`${where} broke`);
  };

  it("a plain throw in a routine goes to the nearest Errored; in development it is UNTYPED_THROW naming the host and the component", async () => {
    const InSetup = component(function* InSetup() {
      throwIn("setup");
      return view(function* () {
        return <i />;
      });
    });
    const InView = component(function* InView() {
      return view(function* () {
        throwIn("view");
        return <i />;
      });
    });
    const InMemo = component(function* InMemo() {
      const m = yield* $memo(function* () {
        throwIn("memo");
        return 1;
      });
      return view(function* () {
        return <i>{perform(m)}</i>;
      });
    });
    const InEffect = component(function* InEffect() {
      yield* $effect(
        function* () {},
        function* () {
          throwIn("effect");
        }
      );
      return view(function* () {
        return <i />;
      });
    });
    const InHole = component(function* InHole() {
      return view(function* () {
        return h("i", function* () {
          throwIn("hole");
          return 1;
        });
      });
    });
    const cases: [string, () => any, string][] = [
      ["setup", InSetup, "a setup in <InSetup>"],
      ["view", InView, "a view in <InView>"],
      ["memo", InMemo, "a memo in <InMemo>"],
      ["effect", InEffect, "an effect in <InEffect>"],
      ["hole", InHole, "a hole in <InHole>"]
    ];
    for (const [where, C, host] of cases) {
      dispose?.();
      root.textContent = "";
      mount(() =>
        Errored({
          fallback: shown,
          children: function* () {
            return <>{yield* C()}</>;
          }
        })
      );
      flush();
      const text = root.textContent!;
      expect(text).toContain(`${where} broke`);
      if (__DEV__) {
        expect(text).toContain(`[UNTYPED_THROW] ${host}:`);
        // reported once, however many runs it crossed
        expect(text.match(/UNTYPED_THROW/g)!.length).toBe(1);
      } else expect(text).not.toContain("UNTYPED_THROW");
    }
  });

  it("an event's plain throw rejects its call; in development as UNTYPED_THROW", async () => {
    let fire!: () => Promise<unknown>;
    const App = component(function* App() {
      fire = $event(function* () {
        throwIn("event");
      });
      return view(function* () {
        return <i />;
      });
    });
    mount(App);
    const error = await fire().then(
      () => null,
      e => e
    );
    expect(String(error)).toContain("event broke");
    if (__DEV__) expect(String(error)).toContain("[UNTYPED_THROW] an event in <App>:");
  });

  it("typed failures are not wrapped", () => {
    const show = (e: any) => <b>{`${e() instanceof Failed}:${e().message}`}</b>;
    const Raises = component(function* Raises() {
      const m = yield* $memo(function* () {
        yield* raise(new Failed("typed"));
        return 1;
      });
      return view(function* () {
        return <p>{perform(m)}</p>;
      });
    });
    mount(() =>
      Errored({
        fallback: show,
        children: function* () {
          return <>{yield* Raises()}</>;
        }
      })
    );
    expect(root.textContent).toBe("true:typed");
    dispose?.();
    root.textContent = "";
    // a plain throw an attempt catches is typed by its handler
    const Attempts = component(function* Attempts() {
      const a = yield* $memo(function* () {
        return yield* attempt(() => {
          throw new Error("handled");
        }, toError);
      });
      return view(function* () {
        return <p>{perform(a)}</p>;
      });
    });
    mount(() =>
      Errored({
        fallback: show,
        children: function* () {
          return <>{yield* Attempts()}</>;
        }
      })
    );
    expect(root.textContent).toBe("true:handled");
  });
});

describe("host state is per run (re-entrancy)", () => {
  it("an async $memo resuming while another view renders: the view's reads are its holes'", async () => {
    let cardViews = 0;
    const Card = component(function* Card(props: Props<{ name: string }>) {
      return view(function* () {
        cardViews++;
        return <b>{perform(props.name)}</b>;
      });
    });
    const App = component(function* App() {
      const card = yield* $memo(function* () {
        const name = yield* attempt(() => Promise.resolve("Ada"), toError);
        // built while the memo resumes after its attempt: Card's setup, view
        // and holes run inside the resumed run, each as its own host
        return createRoot(() => Card({ name }));
      });
      return view(function* () {
        return <div>{perform(card)}</div>;
      });
    });
    mount(() =>
      Loading({
        fallback: "…",
        children: function* () {
          return (
            <>
              {
                yield* Errored({
                  fallback: (e: any) => <i>{String(e())}</i>,
                  children: function* () {
                    return <>{yield* App()}</>;
                  }
                })
              }
            </>
          );
        }
      })
    );
    expect(root.textContent).toBe("…");
    await settle();
    expect(root.textContent).toBe("Ada");
    expect(cardViews).toBe(1);
  });
});

describe("attempt / isPending interplay", () => {
  it("a memo that waits is pending; a superseded run runs to completion and its result is discarded (D-080)", async () => {
    const resolvers: ((v: number) => void)[] = [];
    let after = 0;
    let set!: (v: number) => void;
    const App = component(function* () {
      const [id, setId] = yield* $signal(1);
      set = v => write(() => setId(v));
      const m = yield* $memo(function* () {
        const i = yield* id;
        const v = yield* attempt(() => new Promise<number>(r => resolvers.push(r)), toError);
        after++;
        return v + i;
      });
      return view(function* () {
        return <i>{perform(m)}</i>;
      });
    });
    mount(() =>
      Loading({
        fallback: "…",
        children: function* () {
          return <>{yield* App()}</>;
        }
      })
    );
    set(2);
    flush();
    // the current run lands first …
    resolvers[1](200);
    await settle();
    expect(root.textContent).toBe("202");
    expect(after).toBe(1);
    // … the superseded one still continues after its attempt, and its result does not land
    resolvers[0](100);
    await settle();
    expect(after).toBe(2);
    expect(root.textContent).toBe("202");
    // nor does it subscribe the memo: a later write re-runs only the current run's reads
    set(3);
    flush();
    resolvers[2](300);
    await settle();
    expect(root.textContent).toBe("303");
    void isPending;
  });

  it("a superseded run that fails after its attempt is discarded too (D-080)", async () => {
    const resolvers: ((v: number) => void)[] = [];
    let set!: (v: number) => void;
    const App = component(function* () {
      const [id, setId] = yield* $signal(1);
      set = v => write(() => setId(v));
      const m = yield* $memo(function* () {
        const i = yield* id;
        const v = yield* attempt(() => new Promise<number>(r => resolvers.push(r)), toError);
        if (v < 0) yield* raise(new Failed("stale"));
        return v + i;
      });
      return view(function* () {
        return <i>{perform(m)}</i>;
      });
    });
    mount(() =>
      Errored({
        fallback: (e: any) => <b>{e().message}</b>,
        children: function* () {
          return (
            <>
              {
                yield* Loading({
                  fallback: "…",
                  children: function* () {
                    return <>{yield* App()}</>;
                  }
                })
              }
            </>
          );
        }
      })
    );
    set(2);
    flush();
    resolvers[1](200);
    await settle();
    expect(root.textContent).toBe("202");
    resolvers[0](-1);
    await settle();
    expect(root.textContent).toBe("202");
  });
});

class SaveError extends Error {
  readonly kind = "save" as const;
}
// At module scope: a provider whose context is created inside a test (or a
// describe) callback, at a view's root under an outer Errored, keeps an inner
// Errored's fallback out of the DOM — with Solid's own createContext too, and
// before D-085 (recorded in D-085, not fixed here).
const SaveContext = createContext<EventHandler<[], SaveError, void, false, false>, "SaveContext">();

describe("binding an event is a hole (D-072)", () => {
  it("onClick={yield* save} binds the handler: the click calls it, the bind does not", async () => {
    const calls: unknown[] = [];
    let save!: ReturnType<typeof $event<[MouseEvent], never, void>>;
    const App = component(function* () {
      const [n, setN] = yield* $signal(0);
      save = $event(function* (e: MouseEvent) {
        calls.push(e.type);
        yield* setN(v => v + 1);
      });
      return view(function* () {
        return <button onClick={yield* save}>{yield* n}</button>;
      });
    });
    mount(App);
    // binding is not calling
    expect(calls).toEqual([]);
    // the value bound is a wrapper of the handler, one per bind (D-085):
    // `perform` returns it uncalled
    const bound = perform(save as any) as unknown;
    expect(typeof bound).toBe("function");
    expect(bound).not.toBe(save);
    expect(perform(save as any)).not.toBe(bound);
    expect(calls).toEqual([]);
    expect([...(save as any)]).toEqual([]);
    root.querySelector("button")!.click();
    await settle();
    expect(calls).toEqual(["click"]);
    expect(root.textContent).toBe("1");
  });

  it("the bound-data form: [yield* pick, data] calls pick(data, event)", async () => {
    const picked: unknown[] = [];
    const App = component(function* () {
      const pick = $event(function* (value: string, e: MouseEvent) {
        picked.push([value, e.type]);
      });
      return view(function* () {
        return <button onClick={[yield* pick, "a"]}>go</button>;
      });
    });
    mount(App);
    root.querySelector("button")!.click();
    await settle();
    expect(picked).toEqual([["a", "click"]]);
  });

  it("a bound event's failure reaches the Errored above where it is bound (D-085)", async () => {
    const seen: unknown[] = [];
    const App = component(function* () {
      const fail = $event(function* () {
        yield* raise(new Failed("bound"));
      });
      return view(function* () {
        return <button onClick={yield* fail}>go</button>;
      });
    });
    dispose = render(
      () =>
        Errored({
          fallback: (e: () => unknown) => (seen.push((e() as Error).message), (<p>caught</p>)),
          children: function* () {
            return <>{yield* App()}</>;
          }
        }),
      root
    );
    flush();
    root.querySelector("button")!.click();
    await settle();
    expect(seen).toEqual(["bound"]);
    expect(root.innerHTML).toBe("<p>caught</p>");
  });

  describe("D-085: a bound event's failure routes to the bind site", () => {
    /** Binds the handler it finds in context: the bind site. */
    const Child = component(function* Child() {
      // a context's value is read like a prop (D-098): read the handler, then bind it
      const save = yield* SaveContext;
      return view(function* () {
        return <button onClick={yield* yield* save}>save</button>;
      });
    });
    /** Creates the handler, and renders `Child` under an `Errored` of `Child`'s own. */
    const Parent = component(function* Parent(props: Props<{ seen: string[] }>) {
      const save = $event(function* () {
        yield* raise(new SaveError("save failed"));
      });
      return view(function* () {
        return (
          <SaveContext value={save}>
            {
              yield* Errored({
                fallback: (e: () => SaveError) => <p>child's: {e().message}</p>,
                children: function* () {
                  return <>{yield* Child()}</>;
                }
              })
            }
          </SaveContext>
        );
      });
    });

    it("created in Parent, bound in Child under Child's Errored: that Errored shows it", async () => {
      mount(() => Parent({ seen: [] }));
      root.querySelector("button")!.click();
      await settle();
      expect(root.textContent).toBe("child's: save failed");
    });

    it("with an Errored above both sites too: the bind site's shows it, not the one above the creation", async () => {
      const outer: unknown[] = [];
      mount(() =>
        Errored({
          fallback: (e: () => unknown) => (outer.push(e()), (<p>outer</p>)),
          children: function* () {
            return <>{yield* Parent({ seen: [] })}</>;
          }
        })
      );
      root.querySelector("button")!.click();
      await settle();
      expect(outer).toEqual([]);
      expect(root.textContent).toBe("child's: save failed");
    });

    it("with no Errored above the bind site the DOM call rejects, though one is above the creation site", async () => {
      let save!: EventHandler<[], SaveError, void, false, false>;
      const Creator = component(function* Creator() {
        save = $event(function* () {
          yield* raise(new SaveError("unrouted"));
        });
        return view(function* () {
          return <i>creator</i>;
        });
      });
      const Binder = component(function* Binder() {
        return view(function* () {
          return <button onClick={yield* save}>save</button>;
        });
      });
      const seen: unknown[] = [];
      mount(() =>
        Errored({
          fallback: (e: () => unknown) => (seen.push(e()), (<p>creation's</p>)),
          children: function* () {
            return <>{yield* Creator()}</>;
          }
        })
      );
      // a second root, with no Errored: the bind site
      const other = document.createElement("div");
      document.body.appendChild(other);
      const disposeOther = render(Binder, other);
      flush();
      try {
        // what the DOM calls (Solid's delegated handler), called as the DOM
        // does: nobody handles its promise. Observed through the prototype's
        // `then`, which does not mark the call handled: it rejects
        const button = other.querySelector("button") as any;
        const key = Object.keys(button).find(k => k.endsWith("$$click"))!;
        const result = button[key](new MouseEvent("click")) as Promise<unknown>;
        const outcome = await Promise.prototype.then.call(
          result,
          v => ["resolved", v],
          e => ["rejected", (e as Error).message]
        );
        expect(outcome).toEqual(["rejected", "unrouted"]);
        await settle();
        expect(seen).toEqual([]);
        expect(root.textContent).toBe("creator");
      } finally {
        disposeOther();
        other.remove();
      }
    });

    it("a call from another routine fails at its caller, wherever the handler is bound", async () => {
      const caught: unknown[] = [];
      let call!: () => Promise<unknown>;
      const Caller = component(function* Caller() {
        const save = yield* SaveContext;
        call = $event(function* () {
          const handler = yield* save;
          yield* attempt(
            () => handler(),
            e => {
              caught.push(e);
            }
          );
        });
        return view(function* () {
          return <i>caller</i>;
        });
      });
      const Host = component(function* Host() {
        const save = $event(function* () {
          yield* raise(new SaveError("to the caller"));
        });
        return view(function* () {
          return (
            <SaveContext value={save}>
              {
                yield* Errored({
                  fallback: () => <p>bind site's</p>,
                  children: function* () {
                    return (
                      <>
                        {yield* Child()}
                        {yield* Caller()}
                      </>
                    );
                  }
                })
              }
            </SaveContext>
          );
        });
      });
      mount(Host);
      await call();
      await settle();
      expect(caught.map(e => (e as Error).message)).toEqual(["to the caller"]);
      expect(root.textContent).toBe("savecaller");
    });
  });
});
