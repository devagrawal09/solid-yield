import { $component, $event, $memo, attempt, Errored, Loading, view } from "solid-yield";
import { h, NotFound } from "conformance";

export let setId: (v: number) => unknown;

const notFound = (cause: unknown) =>
  cause instanceof NotFound ? cause : new NotFound(String(cause));
/** The fallback's one hole: records what the boundary caught, shows its name. */
const caught = (error: NotFound) => (h.caught("boundary", error), error.name);

export const App = $component(function* App() {
  const [id, si] = yield* h.$signal("id", 1);
  setId = $event(function* (v: number) {
    yield* si(v);
  });
  const user = yield* $memo(function* () {
    const i = yield* id;
    h.owner("user memo");
    h.run("user(" + i + ")");
    h.where("before wait(" + i + ")");
    const v = yield* attempt(() => h.task<string>("load", i), notFound);
    h.where("after wait(" + i + ")");
    return v;
  });
  return view(function* () {
    return (
      <>
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
                        return <p class="user">{yield* user}</p>;
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
