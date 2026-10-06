/**
 * Runtime evidence for λ-yield's proof obligations (`documentation/calculus.md`
 * §5): one `describe` per obligation that had no runtime test. Each test pins
 * the route the runtime takes today; where that contradicts the rule, the
 * test says so and the calculus records a finding. Views are written in the
 * form the JSX transform's yield rule produces (`perform(x)` for `yield* x`),
 * as in runtime.spec.
 */
import { flush, resetErrorHalt } from "solid-js";
import {
  $cleanup,
  component,
  $effect,
  $event,
  $memo,
  attempt,
  ChunkError,
  createContext,
  Errored,
  For,
  lazy,
  Loading,
  perform,
  raise,
  render,
  Show,
  $signal,
  view,
  type Element as YieldElement,
  type Path,
  type Props,
  type Reset,
  type Source
} from "solid-yield";
import { h } from "solid-yield/h";
import { toFailed, type Failed } from "./failed.js";
import { write } from "./write.js";

declare const __DEV__: boolean;

const tick = () => new Promise<void>(r => setTimeout(r, 0));
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
  resetErrorHalt();
});
function mount(App: () => any) {
  dispose = render(App as any, root);
  flush();
}

class Boom extends Error {
  readonly kind = "boom" as const;
}
class Other extends Error {
  readonly kind = "other" as const;
}

/** A component whose view reads a memo that raises `e`. */
function failing(make: () => Boom | Other) {
  return component(function* Failing() {
    const m = yield* $memo(function* () {
      return yield* raise(make());
    });
    return view(function* () {
      return <i>{perform(m)}</i>;
    });
  });
}

/** An async memo body that lands when `land` is called. */
function deferred() {
  let resolve!: (v: string) => void;
  return {
    body: function* () {
      return yield* attempt(() => new Promise<string>(r => (resolve = r)), toFailed);
    },
    land: (v: string) => resolve(v)
  };
}

/**
 * Runs `body` with Solid's uncaught-error channels captured: `console.error`,
 * an exception thrown from a scheduled flush, an unhandled rejection
 * (vitest's own listeners are set aside, then restored). Solid's scheduling
 * is revived after a halt (`resetErrorHalt`), so later tests still run.
 */
async function captured(body: () => Promise<void> | void) {
  const errors: string[] = [];
  const uncaught: string[] = [];
  const unhandled: string[] = [];
  const spy = vi
    .spyOn(console, "error")
    .mockImplementation((...a: unknown[]) => void errors.push(a.map(String).join(" ")));
  const savedX = process.listeners("uncaughtException");
  const savedR = process.listeners("unhandledRejection");
  process.removeAllListeners("uncaughtException");
  process.removeAllListeners("unhandledRejection");
  const onX = (e: unknown) => void uncaught.push(String(e));
  const onR = (e: unknown) => void unhandled.push(String(e));
  process.on("uncaughtException", onX);
  process.on("unhandledRejection", onR);
  try {
    await body();
  } finally {
    process.off("uncaughtException", onX);
    process.off("unhandledRejection", onR);
    for (const l of savedX) process.on("uncaughtException", l);
    for (const l of savedR) process.on("unhandledRejection", l);
    spy.mockRestore();
    resetErrorHalt();
  }
  return { errors, uncaught, unhandled };
}

// --- O14: run once after mount is an $effect with an empty compute (D-101) --------------------
describe("O14: an $effect with an empty compute runs its effect phase once, after the first render (D-101)", () => {
  it("once: after the mount, before nothing else; a later write re-runs nothing; its $cleanup runs on disposal", async () => {
    const log: string[] = [];
    let setN!: (n: number) => void;
    const C = component(function* C() {
      const [n, set] = yield* $signal(0);
      setN = v => write(() => set(v));
      yield* $effect(
        function* () {},
        function* () {
          // a settled read in the effect phase: its current value, untracked (D-083)
          log.push(`effect ${yield* n}`);
          yield* $cleanup(() => log.push("cleanup"));
        }
      );
      return view(function* () {
        return <b>{perform(n)}</b>;
      });
    });
    mount(() => C());
    expect(log).toEqual(["effect 0"]);
    setN(1);
    await settle();
    expect(root.textContent).toBe("1");
    expect(log).toEqual(["effect 0"]);
    dispose!();
    dispose = undefined;
    expect(log).toEqual(["effect 0", "cleanup"]);
  });

  it("under a pending Loading: held until the boundary shows its content, as onSettled was", async () => {
    const log: string[] = [];
    const d = deferred();
    const C = component(function* C() {
      const m = yield* $memo(d.body);
      yield* $effect(
        function* () {},
        function* () {
          log.push("effect");
        }
      );
      return view(function* () {
        return <b>{perform(m)}</b>;
      });
    });
    mount(() =>
      Loading({
        fallback: "loading",
        children: function* () {
          return <>{perform(C())}</>;
        }
      })
    );
    await settle();
    expect([log, root.textContent]).toEqual([[], "loading"]);
    d.land("done");
    await settle();
    expect([log, root.textContent]).toEqual([["effect"], "done"]);
  });

  it("pending work under another boundary does not hold it (nor did it hold onSettled)", async () => {
    const log: string[] = [];
    const d = deferred();
    const Slow = component(function* Slow() {
      const m = yield* $memo(d.body);
      return view(function* () {
        return <b>{perform(m)}</b>;
      });
    });
    const C = component(function* C() {
      yield* $effect(
        function* () {},
        function* () {
          log.push("effect");
        }
      );
      return view(function* () {
        return <i>c</i>;
      });
    });
    mount(() => (
      <>
        {perform(C())}
        {perform(
          Loading({
            fallback: "loading",
            children: function* () {
              return <>{perform(Slow())}</>;
            }
          })
        )}
      </>
    ));
    expect([log, root.textContent]).toEqual([["effect"], "cloading"]);
    d.land("done");
    await settle();
    expect([log, root.textContent]).toEqual([["effect"], "cdone"]);
  });
});

// --- O19: an effect's failure skips an Errored inside its own component's view (D-073) --------
describe("O19: an effect's failure goes above the calling hole, not into its component's view", () => {
  for (const phase of ["compute", "effect"] as const) {
    it(`an $effect's ${phase} failure: the Errored inside the component's own view does not see it`, async () => {
      const C = component(function* C() {
        yield* $effect(
          function* () {
            if (phase === "compute") return yield* raise(new Boom("compute"));
            return 1;
          },
          function* () {
            if (phase === "effect") yield* raise(new Boom("effect"));
          }
        );
        return view(function* () {
          return (
            <>
              {perform(
                Errored({
                  fallback: (e: any) => <p>inner: {e().message}</p>,
                  children: function* () {
                    return <i>content</i>;
                  }
                })
              )}
            </>
          );
        });
      });
      mount(() =>
        Errored({
          fallback: (e: any) => <p>outer: {e().message}</p>,
          children: function* () {
            return <>{perform(C())}</>;
          }
        })
      );
      await settle();
      expect(root.innerHTML).toBe(`<p>outer: ${phase}</p>`);
    });
  }
});

// --- O22: a memo's pending and failure route above the READ, not its creation ---------------
describe("O22: a memo's pending and failure route from where it is read", () => {
  /** Reads the memo it is given: the read is here, under the creator's inner boundary. */
  const Reader = component(function* Reader(
    props: Props<{ m: Source<string, Boom | Failed, true> }>
  ) {
    return view(function* () {
      return <i>{perform(props.m)}</i>;
    });
  });

  it("failure: the Errored above the read shows it, not the one above the memo's creation", async () => {
    const Creator = component(function* Creator() {
      const m = yield* $memo(function* () {
        return yield* raise(new Boom("memo"));
      });
      return view(function* () {
        return (
          <div>
            {perform(
              Errored({
                fallback: (e: any) => <p>read: {e().message}</p>,
                children: function* () {
                  return <>{perform(Reader({ m }))}</>;
                }
              })
            )}
          </div>
        );
      });
    });
    mount(() =>
      Errored({
        fallback: (e: any) => <p>creation: {e().message}</p>,
        children: function* () {
          return <>{perform(Creator())}</>;
        }
      })
    );
    await settle();
    expect(root.innerHTML).toBe("<div><p>read: memo</p></div>");
  });

  it("pending: the Loading above the read shows its fallback; the one above the creation does not", async () => {
    const d = deferred();
    const Creator = component(function* Creator() {
      const m = yield* $memo(d.body);
      return view(function* () {
        return (
          <div>
            <span>shell</span>
            {perform(
              Loading({
                fallback: "read's",
                children: function* () {
                  return <>{perform(Reader({ m }))}</>;
                }
              })
            )}
          </div>
        );
      });
    });
    mount(() =>
      Loading({
        fallback: "creation's",
        children: function* () {
          return <>{perform(Creator())}</>;
        }
      })
    );
    expect(root.innerHTML).toBe("<div><span>shell</span>read's</div>");
    d.land("v");
    await settle();
    expect(root.innerHTML).toBe("<div><span>shell</span><i>v</i></div>");
  });
});

// --- O25: a Loading's fallback's own pending and failure pass above it ------------------------
describe("O25: a Loading's fallback's own colors pass above it", () => {
  it("its failure reaches the Errored above", () => {
    const d = deferred();
    const Pending = component(function* Pending() {
      const m = yield* $memo(d.body);
      return view(function* () {
        return <b>{perform(m)}</b>;
      });
    });
    const FallbackFails = failing(() => new Other("fallback"));
    mount(() =>
      Errored({
        fallback: (e: any) => <p>outer: {e().message}</p>,
        children: function* () {
          return (
            <>
              {perform(
                Loading({
                  fallback: function* () {
                    return <>{perform(FallbackFails())}</>;
                  },
                  children: function* () {
                    return <>{perform(Pending())}</>;
                  }
                })
              )}
            </>
          );
        }
      })
    );
    expect(root.innerHTML).toBe("<p>outer: fallback</p>");
  });

  it("its pending reaches the Loading above; then the fallback, then the content", async () => {
    const content = deferred();
    const fallback = deferred();
    const reader = (d: ReturnType<typeof deferred>, tag: "b" | "u") =>
      component(function* Reads() {
        const m = yield* $memo(d.body);
        return view(function* () {
          return tag === "b" ? <b>{perform(m)}</b> : <u>{perform(m)}</u>;
        });
      });
    const Content = reader(content, "b");
    const Fallback = reader(fallback, "u");
    mount(() =>
      Loading({
        fallback: "outer",
        children: function* () {
          return (
            <>
              {perform(
                Loading({
                  fallback: function* () {
                    return <>{perform(Fallback())}</>;
                  },
                  children: function* () {
                    return <>{perform(Content())}</>;
                  }
                })
              )}
            </>
          );
        }
      })
    );
    expect(root.innerHTML).toBe("outer");
    fallback.land("fallback");
    await settle();
    expect(root.innerHTML).toBe("<u>fallback</u>");
    content.land("content");
    await settle();
    expect(root.innerHTML).toBe("<b>content</b>");
  });
});

// --- O28 / O29: an Errored's fallback's own colors pass above it (D-071, F-1) ------------------
describe("O28 / O29: an Errored's fallback's own failure reaches the Errored above it", () => {
  const ChildFails = failing(() => new Boom("child"));
  const FallbackFails = failing(() => new Other("fallback"));

  /** An inner Errored whose children fail with Boom and whose fallback fails with Other. */
  function nested(fallback: any) {
    mount(() =>
      Errored({
        fallback: (e: any) => <p>outer: {e().message}</p>,
        children: function* () {
          return (
            <>
              {perform(
                Errored({
                  fallback,
                  children: function* () {
                    return <>{perform(ChildFails())}</>;
                  }
                })
              )}
            </>
          );
        }
      })
    );
  }

  it("a lazy-view fallback (O28)", () => {
    nested(function* () {
      return <>{perform(FallbackFails())}</>;
    });
    expect(root.textContent).toBe("outer: fallback");
  });

  it("a row fallback (error, reset) (O28)", () => {
    nested(function* (_err: Path<Boom>, _reset: Reset) {
      return view(function* () {
        return <>{perform(FallbackFails())}</>;
      });
    });
    expect(root.textContent).toBe("outer: fallback");
  });

  it("a render-function fallback (error, reset) => view (O29)", () => {
    nested((_e: any, _r: any) => FallbackFails());
    expect(root.textContent).toBe("outer: fallback");
  });

  it("an h-output fallback (O29)", () => {
    nested(h(FallbackFails, {}));
    expect(root.textContent).toBe("outer: fallback");
  });

  it("with catch: the fallback's own failure is not this boundary's either", () => {
    mount(() =>
      Errored({
        fallback: (e: any) => <p>outer: {e().message}</p>,
        children: function* () {
          return (
            <>
              {perform(
                Errored({
                  catch: [Boom],
                  fallback: (_e: any, _r: any) => FallbackFails(),
                  children: function* () {
                    return <>{perform(ChildFails())}</>;
                  }
                })
              )}
            </>
          );
        }
      })
    );
    expect(root.textContent).toBe("outer: fallback");
  });

  it("an h-output fallback's pending read reaches the Loading above (O29)", async () => {
    let resolve!: (v: string) => void;
    const Pends = component(function* Pends() {
      const v = yield* $memo(function* () {
        return yield* attempt(() => new Promise<string>(r => (resolve = r)), toFailed);
      });
      return view(function* () {
        return <b>{perform(v)}</b>;
      });
    });
    mount(() =>
      Loading({
        fallback: "loading",
        children: function* () {
          return (
            <>
              {perform(
                Errored({
                  fallback: h(Pends, {}),
                  children: function* () {
                    return <>{perform(ChildFails())}</>;
                  }
                })
              )}
            </>
          );
        }
      })
    );
    expect(root.textContent).toBe("loading");
    resolve("shown");
    await settle();
    expect(root.textContent).toBe("shown");
  });
});

// --- O33: a requirement through flow controls, rows and h, as it resolves at run time --------
describe("O33: a requirement through a flow control, a row and h resolves as typed", () => {
  const UserCtx = createContext<{ name: string }, "UserCtx">(undefined, { name: "UserCtx" } as any);
  const Avatar = component(function* Avatar() {
    const user = yield* UserCtx;
    return view(function* () {
      return <b>{perform(user.name)}</b>;
    });
  });
  const provided = (children: any) => () => UserCtx.provide({ value: { name: "ada" }, children });

  it("a For row calling the reader, inside the provider: every row reads it", () => {
    mount(
      provided(function* () {
        return (
          <>
            {perform(
              For({
                each: [1, 2],
                children: function* (_item: Path<number>) {
                  return view(function* () {
                    return <>{perform(Avatar())}</>;
                  });
                }
              })
            )}
          </>
        );
      })
    );
    expect(root.innerHTML).toBe("<b>ada</b><b>ada</b>");
  });

  it("a Show branch (a lazy view) calling the reader, inside the provider", () => {
    mount(
      provided(function* () {
        return (
          <>
            {perform(
              Show({
                when: true,
                children: function* () {
                  return <>{perform(Avatar())}</>;
                }
              })
            )}
          </>
        );
      })
    );
    expect(root.innerHTML).toBe("<b>ada</b>");
  });

  it("h: a row of h output inside h(Ctx.provide, …)", () => {
    const App = component(function* App() {
      return view(function* () {
        return h(
          UserCtx.provide,
          { value: { name: "h" } },
          For({ each: [1, 2], children: () => h(Avatar, {}) })
        );
      });
    });
    mount(App);
    expect(root.innerHTML).toBe("<b>h</b><b>h</b>");
  });

  it("the same row with no provider: the requirement the type keeps is NO_PROVIDER at run time", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() =>
        mount(() =>
          For({
            each: [1],
            children: function* (_item: Path<number>) {
              return view(function* () {
                return <>{perform(Avatar())}</>;
              });
            }
          })
        )
      ).toThrow(__DEV__ ? "[NO_PROVIDER]" : /context/i);
    } finally {
      error.mockRestore();
    }
  });
});

// --- O34: a provided value is never unset (F-3, S11) --------------------------------------------
describe("O34: provide's value is never undefined; nothing is modelled inside the value", () => {
  const MaybeUser = createContext<{ name: string } | null | undefined, "MaybeUser">(undefined, {
    name: "MaybeUser"
  });
  const Who = component(function* Who() {
    const user = yield* MaybeUser;
    return view(function* () {
      return <b>{perform(user)?.name ?? "nobody"}</b>;
    });
  });
  const app = (value: any) => () =>
    MaybeUser.provide({
      value,
      children: function* () {
        return <>{perform(Who())}</>;
      }
    });

  it("provide({ value: null }) gives null: the reader sees nothing, not a missing provider", () => {
    mount(app(null));
    expect(root.textContent).toBe("nobody");
  });

  it("provide({ value: undefined }) is refused by the type; the runtime reads it as no provider", () => {
    // never called: the type's half
    void (() =>
      // @ts-expect-error [PROVIDE_UNDEFINED] a provided undefined reads as no provider
      MaybeUser.provide({ value: undefined, children: "x" }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => mount(app(undefined))).toThrow(__DEV__ ? "[NO_PROVIDER]" : /context/i);
    } finally {
      error.mockRestore();
    }
  });
});

// --- O37: an event bound under an Errored whose catch excludes its failure (D-085) ----------
describe("O37: an unhandled bound call under an Errored that does not catch its failure", () => {
  class NotFound extends Error {
    readonly kind = "not-found" as const;
  }
  class Forbidden extends Error {
    readonly kind = "forbidden" as const;
  }
  let bump!: () => void;
  const app = (failure: () => Error) =>
    component(function* App() {
      const [n, setN] = yield* $signal(0);
      bump = () => write(() => setN(v => v + 1));
      const go = $event(function* () {
        yield* raise(failure() as Forbidden);
      });
      return view(function* () {
        return <button onClick={perform(go)}>{perform(n)}</button>;
      });
    });
  const App = app(() => new Forbidden("forbidden"));
  const notFoundOnly =
    (Child = App) =>
    () =>
      Errored({
        catch: [NotFound],
        fallback: (e: any) => <p>inner: {e().message}</p>,
        children: function* () {
          return <>{perform(Child())}</>;
        }
      });
  /** What the DOM calls (Solid's delegated handler), called as the DOM does: nobody handles its promise. */
  async function click() {
    const button = root.querySelector("button") as any;
    const key = Object.keys(button).find(k => k.endsWith("$$click"))!;
    const result = button[key](new MouseEvent("click")) as Promise<unknown>;
    return Promise.prototype.then.call(
      result,
      v => ["resolved", v],
      e => ["rejected", (e as Error).message]
    );
  }

  it("with an Errored above that one: the failure passes the inner and shows above", async () => {
    mount(() =>
      Errored({
        fallback: (e: any) => <p>outer: {e().message}</p>,
        children: function* () {
          return <>{perform(notFoundOnly()())}</>;
        }
      })
    );
    expect(await click()).toEqual(["resolved", undefined]);
    await settle();
    expect(root.innerHTML).toBe("<p>outer: forbidden</p>");
  });

  it("with none above, the call rejects (D-085, F-7): nothing is reported, Solid does not halt, and a later write still updates the DOM", async () => {
    mount(notFoundOnly());
    let outcome: unknown;
    const { errors, uncaught, unhandled } = await captured(async () => {
      outcome = await click();
      await settle();
    });
    expect(outcome).toEqual(["rejected", "forbidden"]);
    expect(uncaught).toEqual([]);
    expect(unhandled).toEqual([]);
    expect(errors.some(e => e.includes("[REACTIVITY_HALTED]"))).toBe(false);
    expect(root.innerHTML).toBe("<button>0</button>");
    bump();
    flush();
    expect(root.innerHTML).toBe("<button>1</button>");
  });

  it("the failure its catch covers: that Errored shows it, and the call resolves", async () => {
    mount(notFoundOnly(app(() => new NotFound("missing"))));
    expect(await click()).toEqual(["resolved", undefined]);
    await settle();
    expect(root.innerHTML).toBe("<p>inner: missing</p>");
  });

  it("an Errored with no catch takes every failure: it shows it, and the call resolves", async () => {
    mount(() =>
      Errored({
        fallback: (e: any) => <p>all: {e().message}</p>,
        children: function* () {
          return <>{perform(App())}</>;
        }
      })
    );
    expect(await click()).toEqual(["resolved", undefined]);
    await settle();
    expect(root.innerHTML).toBe("<p>all: forbidden</p>");
  });

  it("the nearest that covers it, past one that does not and under one that would: the middle one shows it", async () => {
    mount(() =>
      Errored({
        fallback: (e: any) => <p>outer: {e().message}</p>,
        children: function* () {
          return (
            <>
              {perform(
                Errored({
                  catch: [Forbidden],
                  fallback: (e: any) => <p>middle: {e().message}</p>,
                  children: function* () {
                    return <>{perform(notFoundOnly()())}</>;
                  }
                })
              )}
            </>
          );
        }
      })
    );
    expect(await click()).toEqual(["resolved", undefined]);
    await settle();
    expect(root.innerHTML).toBe("<p>middle: forbidden</p>");
  });

  it("a crash under catch-only Errored: no class covers it, so the call rejects and Solid does not halt", async () => {
    const Crash = component(function* Crash() {
      const go = $event(function* () {
        (null as any).boom;
      });
      return view(function* () {
        return <button onClick={perform(go)}>go</button>;
      });
    });
    mount(notFoundOnly(Crash as any));
    let outcome: any;
    const { errors, uncaught } = await captured(async () => {
      outcome = await click();
      await settle();
    });
    expect(outcome[0]).toBe("rejected");
    expect(uncaught).toEqual([]);
    expect(errors.some(e => e.includes("[REACTIVITY_HALTED]"))).toBe(false);
    expect(root.innerHTML).toBe("<button>go</button>");
  });
});

// --- O45: a lazy component's chunk-load failure is a ChunkError (F-2 → D-100) -----------------
describe("O45: a lazy component whose import rejects fails with a ChunkError (D-100)", () => {
  const netError = new Error("net down");
  const failingPage = () =>
    lazy(() => Promise.reject(netError) as Promise<{ default: () => YieldElement }>);
  const underLoading = (Page: () => any) =>
    function* () {
      return (
        <>
          {perform(
            Loading({
              fallback: "loading",
              children: function* () {
                return <>{perform(Page())}</>;
              }
            })
          )}
        </>
      );
    };

  for (const mode of ["development", "production"] as const) {
    if ((mode === "development") !== __DEV__) continue;
    it(`with an Errored above: it shows a kinded, branded ChunkError whose cause is the import's rejection (${mode})`, async () => {
      const Page = failingPage();
      const seen: unknown[] = [];
      mount(() =>
        Errored({
          fallback: (e: any) => (
            seen.push(e()),
            (
              <p>
                {e().name} / {e().kind}
              </p>
            )
          ),
          children: underLoading(Page)
        })
      );
      expect(root.textContent).toBe("loading");
      await settle(5);
      expect(root.textContent).toBe("ChunkError / chunk");
      const e = seen[0] as ChunkError;
      expect(e).toBeInstanceOf(ChunkError);
      expect(e.cause).toBe(netError);
      expect(e.specifier).toBe(undefined);
      expect((e as any)[Symbol.for("solid.yield.failure")]).toBe(true);
    });
  }

  it("the module URL the build gives lazy is the ChunkError's specifier", async () => {
    const Page = lazy(
      () => Promise.reject(netError) as Promise<{ default: () => YieldElement }>,
      undefined,
      "src/pages/Page.tsx"
    );
    await expect(Page.preload()).rejects.toMatchObject({
      kind: "chunk",
      specifier: "src/pages/Page.tsx",
      cause: netError
    });
  });

  it("an Errored whose catch lists ChunkError takes it; one listing another class passes it on", async () => {
    const Page = failingPage();
    mount(() =>
      Errored({
        catch: [ChunkError],
        fallback: () => <p>chunk</p>,
        children: function* () {
          return (
            <>
              {perform(
                Errored({
                  catch: [Other],
                  fallback: () => <p>other</p>,
                  children: underLoading(Page)
                })
              )}
            </>
          );
        }
      })
    );
    await settle(5);
    expect(root.textContent).toBe("chunk");
  });

  it("the Errored's reset loads the chunk again, as often as it fails", async () => {
    let fail = true;
    let imports = 0;
    const Loaded = component(function* Loaded() {
      return view(function* () {
        return <b>loaded</b>;
      });
    });
    const Page = lazy(() =>
      ++imports && fail ? Promise.reject(netError) : Promise.resolve({ default: Loaded })
    );
    let reset!: Reset;
    mount(() =>
      Errored({
        fallback: (_e: any, r: Reset) => ((reset = r), (<p>failed</p>)),
        children: underLoading(Page)
      })
    );
    await settle(5);
    expect([root.textContent, imports]).toEqual(["failed", 1]);
    reset();
    await settle(5);
    expect([root.textContent, imports]).toEqual(["failed", 2]);
    fail = false;
    reset();
    await settle(5);
    expect([root.textContent, imports]).toEqual(["loaded", 3]);
  });

  it("with none: the ChunkError is re-thrown (D-033), the call renders nothing, the Loading's fallback goes, and Solid does not halt", async () => {
    const Page = failingPage();
    let thrown: unknown;
    let setN!: (n: number) => void;
    const Counter = component(function* Counter() {
      const [n, set] = yield* $signal(0);
      setN = v => write(() => set(v));
      return view(function* () {
        return <i>{perform(n)}</i>;
      });
    });
    const { errors, uncaught, unhandled } = await captured(async () => {
      try {
        mount(() =>
          Loading({
            fallback: "loading",
            children: function* () {
              return (
                <>
                  [{perform(Page())}]{perform(Counter())}
                </>
              );
            }
          })
        );
        await settle(5);
      } catch (e) {
        thrown = e;
      }
      expect(root.textContent).toBe("[]0");
      setN(1);
      flush();
      expect(root.textContent).toBe("[]1");
    });
    expect(thrown).toBe(undefined);
    expect(uncaught).toEqual(["ChunkError: lazy: a component's chunk failed to load"]);
    expect(errors.some(e => e.includes("[REACTIVITY_HALTED]"))).toBe(false);
    expect(unhandled).toEqual([]);
  });

  it("under an Errored whose catch excludes it, with none above that takes it: re-thrown, as with none", async () => {
    const Page = failingPage();
    const { errors, uncaught } = await captured(async () => {
      mount(() =>
        Errored({
          catch: [Other],
          fallback: () => <p>other</p>,
          children: underLoading(Page)
        })
      );
      await settle(5);
    });
    expect(root.textContent).toBe("");
    expect(uncaught).toEqual(["ChunkError: lazy: a component's chunk failed to load"]);
    expect(errors.some(e => e.includes("[REACTIVITY_HALTED]"))).toBe(false);
  });
});

// --- O49: h's Created: a component called in h's arguments is created before the provider ----
describe("O49: a component called directly in h's arguments is not under a provider in the same expression", () => {
  const Name = createContext<string, "Name">(undefined, { name: "Name" } as any);
  const Reader = component(function* Reader() {
    const name = yield* Name;
    return view(function* () {
      return h("b", name);
    });
  });

  it("Reader() in the arguments runs with the view, before the provider: NO_PROVIDER", () => {
    const Eager = component(function* Eager() {
      return view(function* () {
        return h(Name.provide, { value: "x" }, h("div", Reader()));
      });
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => mount(Eager)).toThrow(__DEV__ ? "[NO_PROVIDER]" : /context/i);
    } finally {
      error.mockRestore();
    }
  });

  it("h(Reader, {}) in the same place is created inside the provider", () => {
    const Deferred = component(function* Deferred() {
      return view(function* () {
        return h(Name.provide, { value: "x" }, h("div", h(Reader, {})));
      });
    });
    mount(Deferred);
    expect(root.innerHTML).toBe("<div><b>x</b></div>");
  });
});
