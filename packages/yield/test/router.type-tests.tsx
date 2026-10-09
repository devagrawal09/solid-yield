/**
 * Type tests: yield components handed to `@solidjs/router` (the version
 * getting-started's app-shell recipe pins), as that recipe writes them.
 * Type-checked by `test-types`.
 *
 * A route page that reads its URL declares its props with the router's
 * types, `Props<RouteProps<"/notes/:mode", undefined>>`. The router types such a page
 * only through `defineRoute({ path, component })`, which reads the params
 * from the path: a bare `{ path, component }` object's `component` is the
 * router's `RouteSectionComponent`, whose props carry no params (`{}` or the
 * open `Params` record), and a page that requires `params.mode` is not
 * assignable to it (TS2322, "Type '{}' is missing the following properties
 * … params, location, data"). That is the router's contract — a plain Solid
 * page declared with `RouteProps<"/notes/:mode">` is refused the same way —
 * so `foreign`'s type is unchanged and the recipe uses `defineRoute`
 * (second first-time-user review, F3).
 */
import { createRouter, defineRoute, type RouteProps } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import { component, createContext, foreign, type Props, view } from "solid-yield";
import { nativeForeign } from "solid-yield/internal";

type Theme = "light" | "dark";
const ThemeCtx = createContext<Theme, "ThemeCtx">(undefined, { name: "ThemeCtx" });

const Home = component(function* Home() {
  return view(function* () {
    return <h1>Home</h1>;
  });
});

const Settings = component(function* Settings() {
  const theme = yield* ThemeCtx;
  return view(function* () {
    return <p class="theme">theme: {yield* theme}</p>;
  });
});

const Notes = component(function* Notes(props: Props<RouteProps<"/notes/:mode", undefined>>) {
  return view(function* () {
    return <h1>notes: {yield* props.params.mode}</h1>;
  });
});

// --- the recipe: a parameterized route goes through defineRoute ------------------------------

export const Router = createRouter({
  routes: [
    { path: "/", component: foreign(Home) },
    defineRoute({ path: "/notes/:mode", component: foreign(Notes) }),
    { path: "/settings", component: foreign(Settings, { provided: [ThemeCtx] }) }
  ]
});

// defineRoute types the page's params from the path: a page declared for
// another pattern is refused there.
const Story = component(function* Story(props: Props<RouteProps<"/stories/:id", undefined>>) {
  return view(function* () {
    return <h1>story {yield* props.params.id}</h1>;
  });
});
// @ts-expect-error — `/notes/:mode` has no `id` param
defineRoute({ path: "/notes/:mode", component: foreign(Story) });

// --- the bare object form refuses a page that requires params (the router's contract) --------

createRouter({
  // @ts-expect-error — TS2322: `{}` is missing `params, location, data`
  routes: [{ path: "/notes/:mode", component: foreign(Notes) }]
});

// the same for a plain Solid page: not specific to yield components
function PlainNotes(props: RouteProps<"/notes/:mode">): JSX.Element {
  return `notes: ${props.params.mode}`;
}
createRouter({
  // @ts-expect-error — TS2322, as above
  routes: [{ path: "/notes/:mode", component: PlainNotes }]
});
createRouter({ routes: [defineRoute({ path: "/notes/:mode", component: PlainNotes })] });

// --- a page that declares no props, handed to defineRoute (F-S43) ----------------------------
// The router passes `RouteSectionProps`. A plain Solid page that declares
// none ignores them; the native lowering's handoff (`nativeForeign`) is typed
// as the plain call so the author's page is accepted. The library dialect's
// `foreign` keeps the component's own type (D-088): an undeclared prop is
// refused, so a library page declares the route props it is given.
function PlainHome(): JSX.Element {
  return "home";
}
createRouter({ routes: [defineRoute({ path: "/", component: PlainHome })] });
createRouter({ routes: [defineRoute({ path: "/", component: nativeForeign(Home) })] });
// @ts-expect-error — [UNDECLARED_PROP] the route props Home does not declare
createRouter({ routes: [defineRoute({ path: "/", component: foreign(Home) })] });
