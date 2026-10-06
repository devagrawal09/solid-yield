// The route tree, in its own module so both the app root and the
// server-function config can share it. The original's `/` is the room as a
// live SERVER component; the yield dialect has no server components (D-058),
// so this twin is the original's `/live` — the room from live DATA sources
// (server functions), rendered in the browser — served at `/` and `/live`.
import { defineRoute, defineRoutes } from "@solidjs/router";
import { foreign } from "solid-yield";
import { IdentityCtx } from "~/lib/identity";
import Live from "~/routes/live";

// The router is plain Solid: it renders a route with no `yield*`, so a
// route's colors stop here (D-088). `foreign` checks the handoff: a route
// may be pending (the app's <Loading> is above the router), and it handles
// its own failures (`Live` has an `Errored` at its root). `Live` requires
// the tab's identity, which the app provides above the router (app.tsx):
// `provided` says so (D-102); the runtime checks it where `Live` is created.
export const routes = defineRoutes([
  defineRoute({ path: ["/", "/live"], component: foreign(Live, { provided: [IdentityCtx] }) })
]);
