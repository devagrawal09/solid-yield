import { Failure } from "solid-yield";
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
  createContext,
  hydrate,
  lazy,
  Loading,
  render,
  renderToStream,
  renderToString,
  view,
  type RootCheck
} from "solid-yield";

class Gone extends Failure("gone") {}
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

// --- the refusal printed is the cause's (a first-time-user review, log item 21) ---------------
// A pending root failed `render`'s constraint, TypeScript fell back to the constraint, whose
// view's requirement is `any`, and the message printed was `[NO_PROVIDER]` — with no context
// missing. A pending root now prints `[PENDING_ROOT]`; `[NO_PROVIDER]` only names a context.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type PendingMessage =
  "[PENDING_ROOT] the root may be pending (a read under it has no Loading above): wrap the root, render(() => Loading({ children: App }), el), or put a Loading around the pending part";
type ProviderMessage =
  "[NO_PROVIDER] the root requires the contexts this property names: provide each above the components that read it (Ctx.provide({ value, children }) around their calls)";
type _pendingOnly = Expect<Equal<keyof RootCheck<typeof App>, PendingMessage>>;
type _pendingThunk = Expect<Equal<keyof RootCheck<() => ReturnType<typeof App>>, PendingMessage>>;
type _wrapped = Expect<
  Equal<RootCheck<() => ReturnType<typeof Loading<typeof App, never>>>, unknown>
>;
const NeedsCtx = createContext<string, "NeedsCtx">(undefined, { name: "NeedsCtx" });
const Reader = component(function* Reader() {
  const v = yield* NeedsCtx;
  return view(function* () {
    return <i>{yield* v}</i>;
  });
});
type _providerOnly = Expect<Equal<keyof RootCheck<typeof Reader>, ProviderMessage>>;
type _providerNames = Expect<Equal<RootCheck<typeof Reader>[ProviderMessage], "NeedsCtx">>;
const PendingReader = component(function* PendingReader() {
  const v = yield* NeedsCtx;
  return view(function* () {
    return (
      <i>
        {yield* v}
        {yield* App()}
      </i>
    );
  });
});
// both: each with its own message
type _both = Expect<Equal<keyof RootCheck<typeof PendingReader>, PendingMessage | ProviderMessage>>;
// @ts-expect-error [PENDING_ROOT] and [NO_PROVIDER] "NeedsCtx"
render(PendingReader, root);
