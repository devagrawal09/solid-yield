// The program documentation/getting-started.md builds, rule by rule. It is
// type-checked (test-types), linted with the twins' lint (test:conformance's
// lint step) and run (getting-started.spec.tsx): edit the two together.
import {
  component,
  $event,
  $memo,
  $signal,
  attempt,
  Errored,
  Loading,
  Show,
  view,
  type Props,
  type Source
} from "solid-yield";

// --- a typed failure: an Error with a literal `kind` --------------------------------------
export class NotFound extends Error {
  readonly kind = "not-found" as const;
}

export type User = { id: number; name: string };
/** A stand-in for a server: users 1 and 2 exist. */
export const users: Record<number, User> = {
  1: { id: 1, name: "Ada" },
  2: { id: 2, name: "Grace" }
};
export function fetchUser(id: number): Promise<User> {
  return new Promise((resolve, reject) =>
    setTimeout(() => (users[id] ? resolve(users[id]) : reject(new Error(`no user ${id}`))), 10)
  );
}

// --- 1. a counter: setup, view, hole, event ------------------------------------------------
export const Counter = component(function* Counter(props: Props<{ step: number }>) {
  // setup: creates, never reads
  const [count, setCount] = yield* $signal(0);
  const add = $event(function* () {
    yield* setCount((yield* count) + (yield* props.step));
  });
  // view: no body; every read is a hole
  return view(function* () {
    return (
      <button class="counter" onClick={yield* add}>
        {yield* count}
      </button>
    );
  });
});

// --- 2. a child that declares the colors it accepts ----------------------------------------
export const UserCard = component(function* UserCard(
  props: Props<{ user: Source<User, NotFound, true> }>
) {
  return view(function* () {
    return <h2 class="user">{yield* props.user.name}</h2>;
  });
});

// --- 3. the app: async data, a typed failure, boundaries, a flow control -------------------
export const App = component(function* App() {
  const [id, setId] = yield* $signal(1);
  // a memo reads, then waits; it retries once, and its failure has a type
  const user = yield* $memo(function* () {
    const current = yield* id;
    return yield* attempt(
      () => fetchUser(current),
      function* () {
        return yield* attempt(
          () => fetchUser(current),
          cause => new NotFound(String(cause))
        );
      }
    );
  });
  const next = $event(function* () {
    yield* setId((yield* id) + 1);
  });
  return view(function* () {
    return (
      <main>
        {yield* Counter({ step: 2 })}
        <button class="next" onClick={yield* next}>
          next user
        </button>
        {
          yield* Show({
            when: function* () {
              return (yield* id) > 1;
            },
            children: function* () {
              return <p class="hint">not the first user</p>;
            }
          })
        }
        {
          yield* Errored({
            catch: [NotFound],
            fallback: err => <p class="error">{err().message}</p>,
            children: function* () {
              return (
                <>
                  {
                    yield* Loading({
                      fallback: "loading…",
                      children: function* () {
                        return <>{yield* UserCard({ user })}</>;
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
