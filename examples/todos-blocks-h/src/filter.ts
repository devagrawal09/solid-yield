import { $cleanup, $event, $settled, $signal } from "solid-blocks";

export type Filter = "all" | "active" | "completed";

function parseHash(hash: string): Filter {
  if (hash === "#/active") return "active";
  if (hash === "#/completed") return "completed";
  return "all";
}

/**
 * The URL hash as a filter source, for a setup: `const filter = yield* hashFilter()`.
 *
 * The value is set externally via `location.hash` (see the `<a href="#/...">`
 * links in `<Footer>`), so there is no public setter. The `hashchange`
 * listener is an `$event` (its write is a `yield*`), attached once the first
 * render settles and removed with the component.
 */
export function* hashFilter() {
  const [filter, setFilter] = yield* $signal<Filter>(parseHash(location.hash));
  const onChange = $event(function* () {
    yield* setFilter(parseHash(location.hash));
  });
  yield* $settled(function* () {
    window.addEventListener("hashchange", onChange);
    yield* $cleanup(() => window.removeEventListener("hashchange", onChange));
  });
  return filter;
}
