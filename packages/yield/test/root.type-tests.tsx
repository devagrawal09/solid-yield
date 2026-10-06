/**
 * Type tests for the root edge (D-033, D-095, D-099): `render`, `hydrate`,
 * `renderToString` and `renderToStream` take a root that is settled and
 * requires no context, and may fail. A pending app is wrapped, explicitly,
 * at the root: `Loading({ children: App })`, with or without a fallback.
 */
import {
  $memo,
  attempt,
  component,
  hydrate,
  lazy,
  Loading,
  render,
  renderToStream,
  renderToString,
  view
} from "solid-yield";

class Gone extends Error {
  readonly kind = "gone" as const;
}
declare const root: HTMLElement;

/** Pending by design, and may fail. */
const App = component(function* App() {
  const data = yield* $memo(function* () {
    return yield* attempt(
      () => Promise.resolve("x"),
      cause => new Gone(String(cause))
    );
  });
  return view(function* () {
    return <p>{yield* data}</p>;
  });
});

// a pending root is refused by every renderer
// @ts-expect-error [PENDING]: wrap it in a Loading at the root
render(App, root);
// @ts-expect-error
hydrate(() => App(), document);
// @ts-expect-error
renderToString(App);
// @ts-expect-error
renderToStream(() => App());

// wrapped at the root: without a fallback (nothing until settled) or with one
render(() => Loading({ children: App }), root);
hydrate(() => Loading({ children: App }), document);
renderToString(() =>
  Loading({
    fallback: function* () {
      return <div>Loading…</div>;
    },
    children: App
  })
);
renderToStream(() => Loading({ children: App }));
// the root may fail (D-033): its failure is re-thrown there
const html: string = renderToString(() => Loading({ children: () => App() }));
void html;
// a lazy page's ChunkError may reach the root too (D-100: re-thrown there, D-033), as the
// rendering twin's pages do
const LazyApp = lazy(() => Promise.resolve({ default: App }));
render(() => Loading({ children: () => LazyApp() }), root);
