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
  component,
  $effect,
  $event,
  $memo,
  $settled,
  attempt,
  createContext,
  Errored,
  For,
  lazy,
  Loading,
  perform,
  raise,
  render,
  Show,
  view,
  type Element as YieldElement,
  type Path,
  type Props,
  type Reset,
  type Source
} from "solid-yield";
import { h } from "solid-yield/h";
import { toFailed, type Failed } from "./failed.js";

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

// --- O14: $settled admits a read that may be pending (S9) -------------------------------------
describe("O14: what onSettled does with a pending read", () => {
  it("a source the view reads under a Loading: the body runs once, after it lands, with its value", async () => {
    const log: unknown[] = [];
    const d = deferred();
    const C = component(function* C() {
      const m = yield* $memo(d.body);
      yield* $settled(function* () {
        log.push("start");
        log.push(yield* m);
      });
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
    expect(log).toEqual([]);
    d.land("done");
    await settle();
    expect(log).toEqual(["start", "done"]);
    expect(root.textContent).toBe("done");
  });

  it("FINDING: a source nothing else waits for is still pending when onSettled fires; the read pends silently and the body runs again, from its start, when it lands", async () => {
    const log: unknown[] = [];
    const d = deferred();
    const C = component(function* C() {
      const m = yield* $memo(d.body);
      yield* $settled(function* () {
        log.push("start");
        log.push(yield* m);
      });
      return view(function* () {
        return <b>settled view</b>;
      });
    });
    const { errors, uncaught, unhandled } = await captured(async () => {
      mount(() =>
        Errored({
          fallback: (e: any) => <p>failed: {String(e())}</p>,
          children: function* () {
            return <>{perform(C())}</>;
          }
        })
      );
      // fired at once; the read threw NotReadyError: no value, no boundary, nothing reported
      expect(log).toEqual(["start"]);
      await settle();
      expect(log).toEqual(["start"]);
      d.land("done");
      await settle();
    });
    // not "once" (S9): the body before the read ran twice
    expect(log).toEqual(["start", "start", "done"]);
    expect(root.textContent).toBe("settled view");
    expect([errors, uncaught, unhandled]).toEqual([[], [], []]);
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
  const MaybeUser = createContext<{ name: string } | null | undefined, "MaybeUser">();
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
  const App = component(function* App() {
    const go = $event(function* () {
      yield* raise(new Forbidden("forbidden"));
    });
    return view(function* () {
      return <button onClick={perform(go)}>go</button>;
    });
  });
  const notFoundOnly = () =>
    Errored({
      catch: [NotFound],
      fallback: (e: any) => <p>inner: {e().message}</p>,
      children: function* () {
        return <>{perform(App())}</>;
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
          return <>{perform(notFoundOnly())}</>;
        }
      })
    );
    await click();
    await settle();
    expect(root.innerHTML).toBe("<p>outer: forbidden</p>");
  });

  it("FINDING: with none above, the call does not reject (D-085 says it does): it resolves, the failure is thrown out of Solid's flush and halts the reactive system", async () => {
    mount(notFoundOnly);
    let outcome: unknown;
    const { errors, uncaught, unhandled } = await captured(async () => {
      outcome = await click();
      for (let i = 0; i < 3; i++) {
        await tick();
        try {
          flush();
        } catch {}
      }
    });
    expect(outcome).toEqual(["resolved", undefined]);
    expect(uncaught).toEqual(["Error: forbidden"]);
    expect(unhandled).toEqual([]);
    expect(errors.some(e => e.includes("[REACTIVITY_HALTED]"))).toBe(true);
    expect(root.innerHTML).toBe("<button>go</button>");
  });
});

// --- O45: a lazy component's chunk-load failure (F-2: the type is Dev's ruling) ---------------
describe("O45: a lazy component whose import rejects (the route today)", () => {
  const failingPage = (message: string) =>
    lazy(() => Promise.reject(new Error(message)) as Promise<{ default: () => YieldElement }>);

  it("with an Errored above: the import's own Error reaches it, unbranded, with no kind", async () => {
    const Page = failingPage("chunk failed");
    mount(() =>
      Errored({
        fallback: (e: any) => (
          <p>
            {e().message} / {String(e().kind)}
          </p>
        ),
        children: function* () {
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
        }
      })
    );
    expect(root.textContent).toBe("loading");
    await settle(5);
    expect(root.textContent).toBe("chunk failed / undefined");
  });

  it("with none: nothing is thrown out of render or flush; the Loading's fallback stays, Solid halts, and the rejection is unhandled", async () => {
    const Page = failingPage("chunk failed");
    let thrown: unknown;
    const { errors, uncaught, unhandled } = await captured(async () => {
      try {
        mount(() =>
          Loading({
            fallback: "loading",
            children: function* () {
              return <>{perform(Page())}</>;
            }
          })
        );
        await settle(5);
      } catch (e) {
        thrown = e;
      }
    });
    expect(thrown).toBe(undefined);
    expect(root.textContent).toBe("loading");
    expect(errors.some(e => e.includes("[REACTIVITY_HALTED]"))).toBe(true);
    expect(unhandled).toEqual(["Error: chunk failed"]);
    expect(uncaught).toEqual([]);
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
