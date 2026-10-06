import { component, $memo, attempt, Errored, Loading, view, type Props } from "solid-yield";
import { h, NotFound } from "conformance";

const notFound = (cause: unknown) =>
  cause instanceof NotFound ? cause : new NotFound(String(cause));
/** The fallback's one hole: records what the boundary caught. */
const caught = (error: NotFound) => (h.caught("errored", error), "error");

const User = component(function* User(props: Props<{ id: string }>) {
  const user = yield* $memo(function* () {
    const id = yield* props.id;
    return yield* attempt(() => h.task<{ name: string }>("load", id), notFound);
  });
  return view(function* () {
    return <h3 class="user">{(yield* user).name}</h3>;
  });
});

export const App = component(function* App() {
  return view(function* () {
    return (
      <main>
        {
          yield* Errored({
            fallback: err => <p class="err">{caught(err())}</p>,
            children: function* () {
              return (
                <>
                  {
                    yield* Loading({
                      fallback: function* () {
                        return <p class="loading">loading</p>;
                      },
                      children: function* () {
                        return <>{yield* User({ id: "1" })}</>;
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
