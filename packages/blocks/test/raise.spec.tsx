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
  constant,
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

declare const __DEV__: boolean;

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
 *   inside the component call, outside any computation; an `$effect`'s
 *   either phase is escalated as itself by Solid's `createEffect`, D-079,
 *   which halts the reactive system when no boundary takes it);
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
    host: "effect's compute",
    make: boom => ({
      App: $component(function* App() {
        yield* $effect(
          function* () {
            yield* raise(boom);
          },
          function* () {}
        );
        return view(function* () {
          return <i>ok</i>;
        });
      })
    }),
    atRoot: "thrown"
  },
  {
    host: "effect's effect phase",
    make: boom => ({
      App: $component(function* App() {
        yield* $effect(
          function* () {},
          function* () {
            yield* raise(boom);
          }
        );
        return view(function* () {
          return <i>ok</i>;
        });
      })
    }),
    atRoot: "thrown"
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
          return <button onClick={yield* go}>go</button>;
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
  it.each(["compute", "effect"] as const)(
    "an $effect's raise in its %s phase reaches the Errored above the component that created it (D-079)",
    phase => {
      const boom = new Boom("effect");
      const Fails = $component(function* Fails() {
        yield* $effect(
          function* () {
            if (phase === "compute") yield* raise(boom);
          },
          function* () {
            if (phase === "effect") yield* raise(boom);
          }
        );
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
    }
  );

  it("an attempt whose onError returns nothing absorbs the failure: it gives undefined; the effect does not fail (D-076)", () => {
    const seen: unknown[] = [];
    const caught: unknown[] = [];
    const App = $component(function* App() {
      yield* $effect(
        function* () {},
        function* () {
          const v =
            (yield* attempt(
              () => JSON.parse("{") as unknown,
              e => {
                caught.push(e);
              }
            )) ?? "fallback";
          seen.push(v);
        }
      );
      return view(function* () {
        return <i>ok</i>;
      });
    });
    dispose = render(App, root);
    flush();
    expect(seen).toEqual(["fallback"]);
    expect(caught).toHaveLength(1);
    expect(caught[0]).toBeInstanceOf(SyntaxError);
    expect(root.innerHTML).toBe("<i>ok</i>");
  });

  it("an absorbed async failure resumes the block with undefined (D-076)", async () => {
    const seen: unknown[] = [];
    let go!: () => Promise<unknown>;
    const App = $component(function* App() {
      go = $event(function* () {
        const v = yield* attempt(
          () => Promise.reject(new Error("network")) as Promise<number>,
          () => {}
        );
        seen.push(v);
        return v ?? 0;
      });
      return view(function* () {
        return <i>ok</i>;
      });
    });
    dispose = render(App, root);
    flush();
    await expect(go()).resolves.toBe(0);
    expect(seen).toEqual([undefined]);
  });

  it("a handler that returns a value absorbs the failure: the attempt gives the value (D-078)", () => {
    const seen: unknown[] = [];
    const App = $component(function* App() {
      yield* $effect(
        function* () {},
        function* () {
          seen.push(
            yield* attempt(
              () => JSON.parse("{") as unknown,
              () => "a value"
            )
          );
        }
      );
      return view(function* () {
        return <i>ok</i>;
      });
    });
    dispose = render(App, root);
    flush();
    expect(seen).toEqual(["a value"]);
  });

  it("a stream's absorbed failure ends the stream", async () => {
    async function* feed() {
      yield 1;
      throw new Error("dropped");
    }
    const got: unknown[] = [];
    const App = $component(function* App() {
      yield* $effect(
        function* () {},
        function* () {
          const stream = yield* attempt(
            () => feed(),
            () => {}
          );
          void (async () => {
            for await (const v of stream ?? []) got.push(v);
            got.push("done");
          })();
        }
      );
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

describe("D-077: an attempt over an event call", () => {
  it("absorbs a synchronous call's failure in an $effect: nothing reaches the Errored", () => {
    const seen: unknown[] = [];
    const caught: unknown[] = [];
    const App = $component(function* App() {
      const fail = $event(function* () {
        yield* raise(new Boom("call"));
      });
      yield* $effect(
        function* () {},
        function* () {
          seen.push(
            yield* attempt(
              () => fail(),
              e => {
                caught.push(e);
              }
            )
          );
        }
      );
      return view(function* () {
        return <i>ok</i>;
      });
    });
    dispose = render(
      () =>
        Errored({
          fallback: <p>caught</p>,
          children: function* () {
            return <>{yield* App()}</>;
          }
        }),
      root
    );
    flush();
    expect(seen).toEqual([undefined]);
    expect(caught).toHaveLength(1);
    expect(caught[0]).toBeInstanceOf(Boom);
    expect(root.innerHTML).toBe("<i>ok</i>");
  });

  it("transforms a synchronous call's failure in an $effect: the Errored gets the new one", () => {
    const seen: unknown[] = [];
    const App = $component(function* App() {
      const fail = $event(function* () {
        yield* raise(new Boom("call"));
      });
      yield* $effect(
        function* () {},
        function* () {
          yield* attempt(
            () => fail(),
            e => new Other(`from ${e.kind}`)
          );
        }
      );
      return view(function* () {
        return <i>ok</i>;
      });
    });
    dispose = render(
      () =>
        Errored({
          fallback: (e: () => unknown) => (seen.push(e()), (<p>caught</p>)),
          children: function* () {
            return <>{yield* App()}</>;
          }
        }),
      root
    );
    flush();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(Other);
    expect((seen[0] as Error).message).toBe("from boom");
  });

  it("waits for an async call in an $event: its result, or undefined when absorbed", async () => {
    const log: unknown[] = [];
    let resolve!: () => void;
    const load = $event(function* (fail: boolean) {
      yield* attempt(
        () => new Promise<void>(r => (resolve = r)),
        () => new Boom("never")
      );
      if (fail) yield* raise(new Boom("late"));
      return 7;
    });
    const outer = $event(function* (fail: boolean) {
      const v = yield* attempt(
        () => load(fail),
        e => {
          log.push(e.message);
        }
      );
      log.push(v);
      return v;
    });
    const ok = outer(false);
    await settle();
    expect(log).toEqual([]);
    resolve();
    expect(await ok).toBe(7);
    const failed = outer(true);
    await settle();
    resolve();
    expect(await failed).toBe(undefined);
    expect(log).toEqual([7, "late", undefined]);
  });

  it("a typed failure is branded in every build: raise's, and a handler's returned Error (D-087)", async () => {
    const BRAND = Symbol.for("solid.blocks.failure");
    const got: unknown[] = [];
    const load = $event(function* () {
      yield* raise(new Boom("inner"));
    });
    const outer = $event(function* () {
      yield* attempt(
        () => load(),
        e => (got.push(e), new Other(e.message))
      );
    });
    const top = $event(function* () {
      yield* attempt(
        () => outer(),
        e => {
          got.push(e);
        }
      );
    });
    await top();
    expect(got.map(e => (e as Error).constructor)).toEqual([Boom, Other]);
    for (const e of got) {
      const d = Object.getOwnPropertyDescriptor(e, BRAND);
      expect(d?.value).toBe(true);
      expect(d?.enumerable).toBe(false);
    }
  });

  it("a crash inside the called event goes past the handler: a bug, not a failure (D-087)", async () => {
    const handled: unknown[] = [];
    const crash = $event(function* (fail: boolean) {
      if (fail) return (null as any).x.y as number; // a TypeError
      yield* raise(new Boom("typed"));
    });
    const outer = $event(function* (fail: boolean) {
      yield* attempt(
        () => crash(fail),
        e => {
          handled.push(e.kind);
        }
      );
      return "absorbed";
    });
    // the typed failure reaches the handler
    expect(await outer(false)).toBe("absorbed");
    expect(handled).toEqual(["boom"]);
    const error = await outer(true).then(
      () => null,
      e => e
    );
    expect(handled).toEqual(["boom"]);
    if (__DEV__) {
      expect(String(error)).toContain("[UNTYPED_THROW] an event");
      // the crash itself is the cause, reported once
      let x: any = error;
      while (x && !(x instanceof TypeError)) x = x.cause;
      expect(x).toBeInstanceOf(TypeError);
    } else expect(error).toBeInstanceOf(TypeError);
  });

  it("a crash in a synchronous call attempted by an $effect reaches the Errored, past the handler (D-087)", () => {
    const handled: unknown[] = [];
    const seen: unknown[] = [];
    const App = $component(function* App() {
      const crash = $event(function* () {
        throw new TypeError("crash");
      });
      yield* $effect(
        function* () {},
        function* () {
          yield* attempt(
            () => crash(),
            e => {
              handled.push(e);
            }
          );
        }
      );
      return view(function* () {
        return <i>ok</i>;
      });
    });
    dispose = render(
      () =>
        Errored({
          fallback: (e: () => unknown) => (seen.push(e()), (<p>caught</p>)),
          children: function* () {
            return <>{yield* App()}</>;
          }
        }),
      root
    );
    flush();
    expect(handled).toEqual([]);
    expect(seen).toHaveLength(1);
    expect(String(seen[0])).toContain("crash");
    if (__DEV__) expect(String(seen[0])).toContain("[UNTYPED_THROW]");
    else expect(seen[0]).toBeInstanceOf(TypeError);
  });

  it("a transformed async call's failure fails the caller with the new one", async () => {
    const load = $event(function* () {
      yield* raise(new Boom("inner"));
    });
    const outer = $event(function* () {
      yield* attempt(
        () => load(),
        e => new Other(e.message)
      );
    });
    await expect(outer()).rejects.toBeInstanceOf(Other);
  });
});

describe("D-078: an attempt's handler may be a generator, run as the host's block code", () => {
  const rejecting = (message: string) => () =>
    Promise.reject(new Error(message)) as Promise<string>;

  it("transforms: the returned Error fails the attempt (the caller's call rejects with it)", async () => {
    const n = constant(2);
    const save = $event(function* () {
      return yield* attempt(rejecting("net"), function* (cause) {
        const k = yield* n;
        return new Boom(`${k}: ${(cause as Error).message}`);
      });
    });
    await expect(save()).rejects.toThrow("2: net");
  });

  it("absorbs with nothing (undefined) or with a value (the attempt gives it)", async () => {
    const seen: unknown[] = [];
    const save = $event(function* () {
      seen.push(yield* attempt(rejecting("a"), function* () {}));
      seen.push(
        yield* attempt(rejecting("b"), function* () {
          return "value";
        })
      );
    });
    await save();
    expect(seen).toEqual([undefined, "value"]);
  });

  it("a nested attempt retries, then falls back", async () => {
    let calls = 0;
    const flaky = () => (++calls < 2 ? Promise.reject(new Error("once")) : Promise.resolve("ok"));
    const retry = $event(function* () {
      return yield* attempt(flaky, function* () {
        return yield* attempt(flaky, () => "fallback");
      });
    });
    expect(await retry()).toBe("ok");
    expect(calls).toBe(2);
    const fallback = $event(function* () {
      return yield* attempt(rejecting("1"), function* () {
        return yield* attempt(rejecting("2"), () => "fallback");
      });
    });
    expect(await fallback()).toBe("fallback");
  });

  it("yield* raise(e) inside the handler fails the attempt with e", async () => {
    const other = new Other("raised");
    const save = $event(function* () {
      yield* attempt(rejecting("x"), function* () {
        yield* raise(other);
      });
    });
    await expect(save()).rejects.toBe(other);
  });

  it("a write in an event's handler is inside the event's transaction: held until it settles", async () => {
    let resolve!: () => void;
    let save!: () => Promise<unknown>;
    const App = $component(function* App() {
      const [status, setStatus] = yield* $signal("idle");
      save = $event(function* () {
        yield* attempt(rejecting("x"), function* () {
          yield* setStatus("failed");
          yield* attempt(
            () => new Promise<void>(r => (resolve = r)),
            () => {}
          );
        });
      });
      return view(function* () {
        return <i>{yield* status}</i>;
      });
    });
    dispose = render(App, root);
    flush();
    const done = save();
    await settle();
    // the handler wrote, then waited: the write is held by the transaction
    expect(root.textContent).toBe("idle");
    resolve();
    await done;
    await settle();
    expect(root.textContent).toBe("failed");
  });

  it("a stream's failure, after the host's run: a plain handler's Error fails the stream, nothing ends it (D-091)", async () => {
    async function* feed() {
      yield 1;
      throw new Error("dropped");
    }
    const ended: unknown[] = [];
    const failed: unknown[] = [];
    const App = $component(function* App() {
      yield* $effect(
        function* () {},
        function* () {
          const a = yield* attempt(
            () => feed(),
            () => {}
          );
          const b = yield* attempt(
            () => feed(),
            cause => new Boom((cause as Error).message)
          );
          void (async () => {
            for await (const v of a ?? []) ended.push(v);
            ended.push("done");
          })();
          void (async () => {
            try {
              for await (const v of b) failed.push(v);
            } catch (e) {
              failed.push(e);
            }
          })();
        }
      );
      return view(function* () {
        return <i>ok</i>;
      });
    });
    // what the stream fails with is its reader's: nothing reaches the component
    dispose = render(App, root);
    flush();
    await settle();
    expect(ended).toEqual([1, "done"]);
    expect(failed[0]).toBe(1);
    expect(failed[1]).toBeInstanceOf(Boom);
    expect((failed[1] as Error).message).toBe("dropped");
  });
});
