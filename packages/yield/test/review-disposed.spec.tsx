/** D-085 F-8: pins current behaviour, not the desired ruling. */
import { flush, resetErrorHalt } from "solid-js";
import {
  $cleanup,
  $event,
  $optimisticStore,
  attempt,
  component,
  Errored,
  For,
  render,
  view
} from "solid-yield";
declare const __DEV__: boolean;
class Locked extends Error {
  readonly kind = "locked" as const;
}
const tick = () => new Promise<void>(r => setTimeout(r, 0));
it.each([false, true])(
  "pins current behaviour when the optimistic move disposes the binder: %s",
  async moves => {
    let disposedRows = 0;
    let innerFailures = 0;
    let outerFailures = 0;
    const App = component(function* App() {
      const [cards, setCards] = yield* $optimisticStore([{ id: 1, column: "a" }]);
      const move = $event(function* () {
        if (moves)
          yield* setCards(draft => {
            draft[0].column = "b";
          });
        yield* attempt(
          () =>
            new Promise<void>((_resolve, reject) =>
              setTimeout(() => reject(new Error("locked")), 10)
            ),
          e => new Locked(String(e))
        );
      });
      return view(function* () {
        return (
          <main>
            {
              yield* Errored({
                catch: [Locked],
                fallback: () => {
                  outerFailures++;
                  return <p class="outer-error">outer</p>;
                },
                children: function* () {
                  return (
                    <section>
                      {
                        yield* For({
                          each: function* () {
                            return (yield* cards).filter(card => card.column === "a");
                          },
                          children: function* (_card) {
                            yield* $cleanup(() => {
                              disposedRows++;
                            });
                            return view(function* () {
                              return (
                                <article>
                                  {
                                    yield* Errored({
                                      catch: [Locked],
                                      fallback: () => {
                                        innerFailures++;
                                        return <p class="move-error">locked</p>;
                                      },
                                      children: function* () {
                                        return <button onClick={yield* move}>move</button>;
                                      }
                                    })
                                  }
                                </article>
                              );
                            });
                          }
                        })
                      }
                    </section>
                  );
                }
              })
            }
          </main>
        );
      });
    });
    const root = document.createElement("div");
    document.body.append(root);
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let dispose: (() => void) | undefined;
    try {
      dispose = render(App, root);
      flush();
      const button = root.querySelector("button") as any;
      const key = Object.keys(button).find(k => k.endsWith("$$click"))!;
      const result = button[key](new MouseEvent("click")) as Promise<unknown>;
      // Observe without marking the event call handled; this is the DOM's route.
      const outcome = Promise.prototype.then.call(
        result,
        v => ["resolved", v],
        e => ["rejected", e]
      );
      flush();
      if (moves) expect(root.querySelector("button")).toBeNull();
      expect(await outcome).toEqual(["resolved", undefined]);
      for (let i = 0; i < 3; i++) {
        await tick();
        flush();
      }
      expect(innerFailures).toBe(moves ? 0 : 1);
      expect(outerFailures).toBe(0);
      if (moves) {
        expect(disposedRows).toBeGreaterThan(0);
        expect(root.querySelector(".move-error")).toBeNull();
        const log = [...warnings.mock.calls, ...errors.mock.calls].flat().map(String).join("\n");
        if (__DEV__) expect(log).toContain("[RUN_WITH_DISPOSED_OWNER]");
        expect(log).not.toContain("[BOUNDARY_DISPOSED]");
      } else expect(root.textContent).toBe("locked");
    } finally {
      dispose?.();
      root.remove();
      warnings.mockRestore();
      errors.mockRestore();
      resetErrorHalt();
    }
  }
);
