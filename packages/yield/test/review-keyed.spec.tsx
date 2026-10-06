import { flush, resetErrorHalt } from "solid-js";
import {
  $event,
  $memo,
  $signal,
  attempt,
  component,
  Errored,
  Loading,
  Show,
  render,
  view,
  type Props
} from "solid-yield";
class Drop extends Error {
  readonly kind = "drop" as const;
}
const tick = () => new Promise<void>(r => setTimeout(r, 0));
async function settle() {
  for (let i = 0; i < 4; i++) {
    await tick();
    flush();
  }
}
it("chat review: keyed remount of a failed stream", async () => {
  let subscriptions = 0;
  async function* watch() {
    yield ++subscriptions;
    await tick();
    throw new Error("drop");
  }
  const Live = component(function* Live(props: Props<{ attempt: number }>) {
    const data = yield* $memo(function* () {
      yield* props.attempt;
      return yield* attempt(watch, e => new Drop(String(e)));
    });
    return view(function* () {
      return <p>{yield* data}</p>;
    });
  });
  const App = component(function* App() {
    const [version, setVersion] = yield* $signal(1);
    const retry = $event(function* () {
      yield* setVersion((yield* version) + 1);
    });
    return view(function* () {
      return (
        <main>
          {
            yield* Show({
              when: version,
              keyed: true,
              children: function* (v) {
                return view(function* () {
                  return (
                    <>
                      {
                        yield* Errored({
                          catch: [Drop],
                          fallback: "disconnected",
                          children: function* () {
                            return (
                              <>
                                {
                                  yield* Loading({
                                    children: function* () {
                                      return <>{yield* Live({ attempt: v })}</>;
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
              }
            })
          }
          <button onClick={yield* retry}>new</button>
        </main>
      );
    });
  });
  const root = document.createElement("div");
  document.body.append(root);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  let dispose: (() => void) | undefined;
  try {
    dispose = render(App, root);
    flush();
    await settle();
    expect(root.textContent).toContain("disconnected");
    root.querySelector("button")!.click();
    flush();
    await settle();
    expect(subscriptions).toBe(2);
    expect(errors.mock.calls.flat().map(String).join("\n")).not.toContain("REACTIVITY_HALTED");
  } finally {
    dispose?.();
    root.remove();
    errors.mockRestore();
    resetErrorHalt();
  }
});

it("plain Solid: a keyed Show remounts the failed stream boundary", async () => {
  const {
    createSignal,
    createMemo,
    Errored: SolidErrored,
    Loading: SolidLoading,
    Show: SolidShow
  } = await import("solid-js");
  const { render: solidRender } = await import("@solidjs/web");
  let subscriptions = 0;
  async function* watch() {
    yield ++subscriptions;
    await tick();
    throw new Drop("drop");
  }
  function Live() {
    const data = createMemo(watch);
    return <p>{data()}</p>;
  }
  const [version, setVersion] = createSignal(1);
  const root = document.createElement("div");
  document.body.append(root);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  let dispose: (() => void) | undefined;
  try {
    dispose = solidRender(
      () => (
        <main>
          <SolidShow when={version()} keyed>
            {_v => (
              <SolidErrored fallback="disconnected">
                <SolidLoading>
                  <Live />
                </SolidLoading>
              </SolidErrored>
            )}
          </SolidShow>
        </main>
      ),
      root
    );
    flush();
    await settle();
    expect(root.textContent).toBe("disconnected");
    setVersion(2);
    flush();
    await settle();
    expect(subscriptions).toBe(2);
    expect(root.textContent).toBe("disconnected");
    expect(errors.mock.calls.flat().map(String).join("\n")).not.toContain("REACTIVITY_HALTED");
  } finally {
    dispose?.();
    root.remove();
    errors.mockRestore();
    resetErrorHalt();
  }
});

it("changing the memo dependency creates a fresh stream, even when the old iterator is retained", async () => {
  let subscriptions = 0;
  let resetBoundary: () => unknown = () => {};
  async function* watch() {
    yield ++subscriptions;
    await tick();
    throw new Drop("drop");
  }
  const App = component(function* App() {
    const [version, setVersion] = yield* $signal(0);
    let last = -1;
    let stream: AsyncGenerator<number>;
    const data = yield* $memo(function* () {
      const next = yield* version;
      if (next !== last) {
        last = next;
        stream = watch();
      }
      return yield* attempt(
        () => stream,
        cause => new Drop(String(cause))
      );
    });
    const retry = $event(function* () {
      yield* setVersion((yield* version) + 1);
      resetBoundary();
    });
    return view(function* () {
      return (
        <main>
          {
            yield* Errored({
              catch: [Drop],
              fallback: (_err, reset) => {
                resetBoundary = reset;
                return <button onClick={reset}>reset only</button>;
              },
              children: function* () {
                return (
                  <>
                    {
                      yield* Loading({
                        children: function* () {
                          return <p>{yield* data}</p>;
                        }
                      })
                    }
                  </>
                );
              }
            })
          }
          <button class="reconnect" onClick={yield* retry}>
            reconnect
          </button>
        </main>
      );
    });
  });
  const root = document.createElement("div");
  document.body.append(root);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  let dispose: (() => void) | undefined;
  try {
    dispose = render(App, root);
    flush();
    await settle();
    expect(subscriptions).toBe(1);
    root.querySelector("button")!.click();
    flush();
    await settle();
    expect(subscriptions).toBe(1);
    root.querySelector<HTMLButtonElement>(".reconnect")!.click();
    flush();
    await settle();
    expect(subscriptions).toBe(2);
    expect(root.textContent).toContain("reset only");
    expect(errors.mock.calls.flat().map(String).join("\n")).not.toContain("REACTIVITY_HALTED");
  } finally {
    dispose?.();
    root.remove();
    errors.mockRestore();
    resetErrorHalt();
  }
});
