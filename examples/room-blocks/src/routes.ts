// The route tree, in its own module so both the app root and the
// server-function config can share it. The original's `/` is the room as a
// live SERVER component; the blocks model has no server components (D-058),
// so this twin is the original's `/live` — the room from live DATA sources
// (server functions), rendered in the browser — served at `/` and `/live`.
import { defineRoute, defineRoutes } from "@solidjs/router";
import type { Component } from "solid-blocks";
import Live from "~/routes/live";

/**
 * The router is plain Solid: its types do not see a block component's
 * pending / failures. A route renders under the app's <Loading> (app.tsx),
 * so it may be pending; it must handle its own failures.
 */
function route<P>(component: Component<P, boolean, never>): Component<P, boolean, never> {
  return component;
}

export const routes = defineRoutes([defineRoute({ path: ["/", "/live"], component: route(Live) })]);
