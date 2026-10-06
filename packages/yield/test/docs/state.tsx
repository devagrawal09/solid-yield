import { Failure } from "solid-yield";
import {
  $effect,
  $event,
  $memo,
  $optimisticStore,
  $signal,
  $store,
  attempt,
  component,
  Errored,
  For,
  Loading,
  refresh,
  view
} from "solid-yield";

export const Preferences = component(function* Preferences() {
  const [settings, setSettings] = yield* $store<{ theme: "light" | "dark" }>({ theme: "light" });
  const toggle = $event(function* () {
    yield* setSettings(draft => {
      draft.theme = draft.theme === "light" ? "dark" : "light";
    });
  });
  return view(function* () {
    return (
      <button class="theme" onClick={yield* toggle}>
        {yield* settings.theme}
      </button>
    );
  });
});

export const EffectCounter = component(function* EffectCounter() {
  const [count, setCount] = yield* $signal(0);
  const [label, setLabel] = yield* $signal("");
  yield* $effect(
    function* () {
      return yield* count;
    },
    function* (value) {
      document.title = `Count ${value}`;
      yield* setLabel(`Count ${value}`);
    }
  );
  const increment = $event(function* () {
    yield* setCount(n => n + 1);
  });
  return view(function* () {
    return (
      <button class="effect-counter" onClick={yield* increment}>
        {yield* label}
      </button>
    );
  });
});

export class NetworkError extends Failure("network") {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}
export type Card = { id: number; column: "todo" | "done" };
export type BoardApi = {
  readCards(): Promise<Card[]>;
  moveCard(id: number, column: Card["column"]): Promise<void>;
};
export function boardWith(api: BoardApi) {
  return component(function* Board() {
    const remote = yield* $memo(function* () {
      return yield* attempt(
        () => api.readCards(),
        cause => new NetworkError(cause)
      );
    });
    const [cards, setCards] = yield* $optimisticStore(function* (_draft: Card[]) {
      return yield* remote;
    }, []);
    const move = $event(function* () {
      yield* setCards(draft => {
        draft[0].column = "done";
      });
      yield* attempt(
        () => api.moveCard(1, "done"),
        cause => new NetworkError(cause)
      );
      yield* refresh(remote);
    });
    return view(function* () {
      return (
        <main>
          {
            yield* Errored({
              catch: [NetworkError],
              fallback: err => <p role="alert">{err().message}</p>,
              children: function* () {
                return (
                  <>
                    {
                      yield* Loading({
                        fallback: "Loading cards…",
                        children: function* () {
                          return (
                            <section>
                              <button class="move" onClick={yield* move}>
                                Move card 1
                              </button>
                              <ul>
                                {
                                  yield* For({
                                    each: cards,
                                    children: function* (card) {
                                      return view(function* () {
                                        return <li>{yield* card.column}</li>;
                                      });
                                    }
                                  })
                                }
                              </ul>
                            </section>
                          );
                        }
                      })
                    }
                  </>
                );
              }
            })
          }
        </main>
      );
    });
  });
}
