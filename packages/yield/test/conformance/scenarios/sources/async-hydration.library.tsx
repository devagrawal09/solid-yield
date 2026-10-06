import { $component, $event, $memo, attempt, Loading, view } from "solid-yield";
import { h, NotFound } from "conformance";

export let setId: (v: number) => unknown;

export const App = $component(function* App() {
  const [id, si] = yield* h.$signal("id", 1);
  setId = $event(function* (v: number) {
    yield* si(v);
  });
  const user = yield* $memo(function* () {
    const i = yield* id;
    h.run("user(" + i + ")");
    return yield* attempt(
      () => h.task<string>("user" + i),
      cause => new NotFound(String(cause))
    );
  });
  return view(function* () {
    return (
      <section>
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
      </section>
    );
  });
});
