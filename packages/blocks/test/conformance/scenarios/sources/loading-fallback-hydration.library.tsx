import { $component, $event, Loading, view } from "solid-blocks";
import { h } from "conformance";

export let setName: (v: string) => unknown;

// A call-form `Loading` whose content is settled: the server renders the
// content in place and never the fallback. The fallback is a lazy view, built
// only when it shows (D-092); written as JSX it would be built with the
// holding view's hole and, while hydrating, claim a server node that is not
// there (hydrate-self-test.spec.ts plants that).
export const App = $component(function* App() {
  const [name, sn] = yield* h.$signal("name", "ada");
  setName = $event(function* (v: string) {
    yield* sn(v);
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
              return <p class="user">{yield* name}</p>;
            }
          })
        }
      </section>
    );
  });
});
