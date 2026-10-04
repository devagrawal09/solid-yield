import { $component, $event, attempt, createContext, view } from "solid-blocks";
import { h } from "conformance";

class SaveError extends Error {
  readonly kind = "save" as const;
}

const Api = createContext("api");
/** A helper that reads a context: delegated to, so its read is the setup's context read. */
function* useApi() {
  return yield* Api;
}

const Saver = $component(function* Saver() {
  const api = yield* useApi();
  const [saved, setSaved] = yield* h.$signal("saved", "none");
  const save = $event(function* () {
    h.run("save");
    const value = yield* attempt(
      () => h.task<string>("save", api),
      cause => new SaveError(String(cause))
    );
    h.run("resumed");
    yield* setSaved(value);
  });
  return view(function* () {
    return (
      <button class="save" onClick={yield* save}>
        {yield* saved}
      </button>
    );
  });
});

export const App = $component(function* App() {
  return view(function* () {
    return <Api value="remote">{yield* Saver({})}</Api>;
  });
});
