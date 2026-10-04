/**
 * `raise` at every host (Phase 4 item 2): a kinded failure raised in a setup,
 * a hole (a prop's, a flow control's), a memo (before and after an async
 * attempt), an effect, a `$settled`, an event and a row reaches the nearest
 * `Errored` as itself — an `Errored` whose `catch` does not list it passes it
 * up — and with no `Errored` it is re-thrown at the root (D-033): the library
 * installs no boundary. raise.type-tests.tsx is the type half (`FailsOf` at
 * each position).
 */
import { flush } from "solid-js";
import {
  $component,
  $effect,
  $event,
  $memo,
  $settled,
  $signal,
  attempt,
  Errored,
  For,
  Loading,
  raise,
  render,
  Show,
  view,
  type Props,
  type Source,
  type View
} from "solid-blocks";

class Boom extends Error {
  readonly kind = "boom" as const;
}
class Other extends Error {
  readonly kind = "other" as const;
}
const tick = () => new Promise<void>(r => setTimeout(r, 0));
async function settle(times = 3) {
  for (let i = 0; i < times; i++) {
    await tick();
    flush();
  }
}

/** A child read through a hole prop: its view's hole runs the parent's `function*`. */
const Child = $component(function* Child(props: Props<{ n: Source<number, Boom> }>) {
  return view(function* () {
    return <i>{yield* props.n}</i>;
  });
});

/**
 * How a failure with no `Errored` reaches the root:
 * - `thrown`: the failure itself is thrown out of `render` (a setup runs
 *   inside the component call, outside any computation);
 * - `cause`: Solid re-throws the failure of a computation as its own error,
 *   the failure its `cause`;
 * - `unhandled`: a computation failing after an async step (a memo resumed
 *   after its attempt) fails outside any synchronous caller: Solid's error,
 *   the failure its `cause`, is an unhandled rejection;
 * - `rejects`: an event's call rejects with it (a DOM dispatch, which nobody
 *   handles, leaves an unhandled rejection).
 */
type AtRoot = "thrown" | "cause" | "unhandled" | "rejects";

interface HostCase {
  host: string;
  /** Returns the component raising `boom`, and its event if it has one. */
  make: (boom: Boom) => { App: () => View<false, unknown>; event?: () => Promise<unknown> };
  /** What makes it raise after mount (an event's click; settling an async attempt). */
  drive?: (root: HTMLElement) => Promise<void>;
  atRoot: AtRoot;
}

const hosts: HostCase[] = [
  {
    host: "setup",
    make: boom => ({
      App: $component(function* App() {
        // Raise is not a SetupOp (raise.type-tests.tsx): reached through a cast
        yield* raise(boom) as any;
        return view(function* () {
          return <i>never</i>;
        });
      })
    }),
    atRoot: "thrown"
  },
  {
    host: "hole (a prop's)",
    make: boom => ({
      App: $component(function* App() {
        return view(function* () {
          return (
            <b>
              {
                yield* Child({
                  n: function* () {
                    return yield* raise(boom);
                  }
                })
              }
            </b>
          );
        });
      })
    }),
    atRoot: "cause"
  },
  {
    host: "hole (a flow control's source)",
    make: boom => ({
      App: $component(function* App() {
        return view(function* () {
          return (
            <p>
              {
                yield* Show({
                  when: function* () {
                    return yield* raise(boom);
                  },
                  children: function* () {
                    return <i>shown</i>;
                  }
                })
              }
            </p>
          );
        });
      })
    }),
    atRoot: "cause"
  },
  {
    host: "memo",
    make: boom => ({
      App: $component(function* App() {
        const m = yield* $memo(function* () {
          return yield* raise(boom);
        });
        return view(function* () {
          return <i>{yield* m}</i>;
        });
      })
    }),
    atRoot: "cause"
  },
  {
    host: "memo (after an async attempt)",
    make: boom => {
      const Async = $component(function* Async() {
        const m = yield* $memo(function* () {
          const n = yield* attempt(
            () => Promise.resolve(1),
            () => new Other()
          );
          if (n > 0) yield* raise(boom);
          return n;
        });
        return view(function* () {
          return <i>{yield* m}</i>;
        });
      });
      // pending first: under a Loading, which handles pending only
      return {
        App: $component(function* App() {
          return view(function* () {
            return (
              <>
                {
                  yield* Loading({
                    fallback: "…",
                    children: function* () {
                      return <>{yield* Async()}</>;
                    }
                  })
                }
              </>
            );
          });
        })
      };
    },
    drive: () => settle(),
    atRoot: "unhandled"
  },
  {
    host: "effect",
    make: boom => ({
      App: $component(function* App() {
        yield* $effect(function* () {
          yield* raise(boom);
        });
        return view(function* () {
          return <i>ok</i>;
        });
      })
    }),
    atRoot: "cause"
  },
  {
    host: "$settled",
    make: boom => ({
      App: $component(function* App() {
        yield* $settled(function* () {
          yield* raise(boom);
        });
        return view(function* () {
          return <i>ok</i>;
        });
      })
    }),
    atRoot: "cause"
  },
  {
    host: "event",
    make: boom => {
      let event!: () => Promise<unknown>;
      const App = $component(function* App() {
        const go = $event(function* () {
          yield* raise(boom);
        });
        event = go;
        return view(function* () {
          return <button onClick={go}>go</button>;
        });
      });
      return {
        App,
        get event() {
          return event;
        }
      };
    },
    drive: async root => {
      root.querySelector("button")!.click();
      await settle();
    },
    atRoot: "rejects"
  },
  {
    host: "row",
    make: boom => ({
      App: $component(function* App() {
        const [items] = yield* $signal([1, 2]);
        return view(function* () {
          return (
            <ul>
              {
                yield* For({
                  each: items,
                  children: function* (item) {
                    const m = yield* $memo(function* () {
                      const v = yield* item;
                      if (v === 2) yield* raise(boom);
                      return v;
                    });
                    return view(function* () {
                      return <li>{yield* m}</li>;
                    });
                  }
                })
              }
            </ul>
          );
        });
      })
    }),
    atRoot: "cause"
  }
];

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

describe.each(hosts)("raise in a $host", ({ host, make, drive, atRoot }) => {
  it("reaches the nearest Errored, as itself", async () => {
    const boom = new Boom(host);
    const { App } = make(boom);
    const inner: unknown[] = [];
    const outer: unknown[] = [];
    dispose = render(
      () =>
        Errored({
          fallback: (e: () => unknown) => (outer.push(e()), (<p>outer</p>)),
          children: function* () {
            return (
              <>
                {
                  yield* Errored({
                    fallback: (e: () => unknown) => (inner.push(e()), (<p>inner</p>)),
                    children: function* () {
                      return <>{yield* App()}</>;
                    }
                  })
                }
              </>
            );
          }
        }),
      root
    );
    flush();
    await drive?.(root);
    expect(inner[0]).toBe(boom);
    expect(new Set(inner)).toEqual(new Set([boom]));
    expect(outer).toEqual([]);
    expect(root.innerHTML).toBe("<p>inner</p>");
  });

  it("passes an Errored whose catch does not list it, to the one above", async () => {
    const boom = new Boom(host);
    const { App } = make(boom);
    const outer: unknown[] = [];
    dispose = render(
      () =>
        Errored({
          fallback: (e: () => unknown) => (outer.push(e()), (<p>outer</p>)),
          children: function* () {
            return (
              <>
                {
                  yield* Errored({
                    catch: [Other],
                    fallback: () => <p>inner</p>,
                    children: function* () {
                      return <>{yield* App()}</>;
                    }
                  })
                }
              </>
            );
          }
        }),
      root
    );
    flush();
    await drive?.(root);
    expect(outer[0]).toBe(boom);
    expect(root.innerHTML).toBe("<p>outer</p>");
  });

  it(`with no Errored, is re-thrown at the root (D-033: ${atRoot})`, async () => {
    const boom = new Boom(host);
    const made = make(boom);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => void unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    let thrown: unknown;
    try {
      dispose = render(made.App, root);
      flush();
      if (atRoot === "rejects") {
        // a call nobody else handles rejects with the failure
        await expect(made.event!()).rejects.toBe(boom);
      } else await drive?.(root);
      await settle();
    } catch (e) {
      thrown = e;
    } finally {
      process.off("unhandledRejection", onUnhandled);
      error.mockRestore();
    }
    if (atRoot === "thrown") expect(thrown).toBe(boom);
    else if (atRoot === "cause") {
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).cause).toBe(boom);
    } else if (atRoot === "unhandled") {
      expect(thrown).toBeUndefined();
      expect(unhandled.length).toBe(1);
      expect(unhandled[0]).toBeInstanceOf(Error);
      expect((unhandled[0] as Error).cause).toBe(boom);
    } else {
      expect(thrown).toBeUndefined();
      expect(unhandled).toEqual([]);
    }
  });
});

describe("D-073: an effect's failure is its component's", () => {
  it("an $effect's raise reaches the Errored above the component that created it", () => {
    const boom = new Boom("effect");
    const Fails = $component(function* Fails() {
      yield* $effect(function* () {
        yield* raise(boom);
      });
      return view(function* () {
        return <i>ok</i>;
      });
    });
    const seen: unknown[] = [];
    // the component's view type is View<false, Boom> (raise.type-tests.tsx): the Errored
    // above it handles what its effect raises
    dispose = render(
      () =>
        Errored({
          fallback: (e: () => unknown) => (seen.push(e()), (<p>caught</p>)),
          children: function* () {
            return <>{yield* Fails()}</>;
          }
        }),
      root
    );
    flush();
    expect(seen).toEqual([boom]);
    expect(root.innerHTML).toBe("<p>caught</p>");
  });

  it("an attempt whose onError absorbs the failure gives its value; the effect does not fail", () => {
    const seen: unknown[] = [];
    const App = $component(function* App() {
      yield* $effect(function* () {
        const v = yield* attempt(
          () => JSON.parse("{") as unknown,
          () => "fallback"
        );
        seen.push(v);
      });
      return view(function* () {
        return <i>ok</i>;
      });
    });
    dispose = render(App, root);
    flush();
    expect(seen).toEqual(["fallback"]);
    expect(root.innerHTML).toBe("<i>ok</i>");
  });

  it("an absorbed async failure resumes the block with the handler's value", async () => {
    const seen: unknown[] = [];
    let go!: () => Promise<unknown>;
    const App = $component(function* App() {
      go = $event(function* () {
        const v = yield* attempt(
          () => Promise.reject(new Error("network")),
          () => 0
        );
        seen.push(v);
        return v;
      });
      return view(function* () {
        return <i>ok</i>;
      });
    });
    dispose = render(App, root);
    flush();
    await expect(go()).resolves.toBe(0);
    expect(seen).toEqual([0]);
  });

  it("a stream's absorbed failure ends the stream", async () => {
    async function* feed() {
      yield 1;
      throw new Error("dropped");
    }
    const got: unknown[] = [];
    const App = $component(function* App() {
      yield* $effect(function* () {
        const stream = yield* attempt(
          () => feed(),
          () => "ended"
        );
        void (async () => {
          for await (const v of stream) got.push(v);
          got.push("done");
        })();
      });
      return view(function* () {
        return <i>ok</i>;
      });
    });
    dispose = render(App, root);
    flush();
    await settle();
    expect(got).toEqual([1, "done"]);
  });
});
