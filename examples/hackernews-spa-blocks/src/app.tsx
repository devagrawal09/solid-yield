// The client side of the SSR-SPA baseline (examples/hackernews-spa's App, as
// a block): every template lives here, rendered in the browser from JSON.
//
// The router is created at module scope (as in the original) and the app's
// tree is built by App's view (JSX only in a view, D-041); a view runs once
// (D-032), so the router is not re-created.
import { createRouter, defineRoute } from "@solidjs/router";
import { $component, foreign, Loading, view } from "solid-blocks";
import Nav from "~/components/nav";
import Stories, { preload as preloadStories } from "~/routes/stories";
import Story, { preload as preloadStory } from "~/routes/story";
import User, { preload as preloadUser } from "~/routes/user";
import "./app.css";

// The router is plain Solid: it renders a route with no `yield*`, so a
// route's colors stop here (D-088). `foreign` checks each handoff: a route
// may be pending (the app's <Loading> is around the route), and it handles
// its own failure (each route's view has an `Errored` at its root).
const Router = createRouter({
  routes: [
    defineRoute({
      path: ["/", "/top", "/new", "/show", "/ask", "/job"],
      component: foreign(Stories),
      preload: preloadStories
    }),
    defineRoute({ path: "/stories/:id", component: foreign(Story), preload: preloadStory }),
    defineRoute({ path: "/users/:id", component: foreign(User), preload: preloadUser })
  ]
});

const App = $component(function* App() {
  // JSX only in a view (D-041): the view runs once (D-032), so the router it
  // builds is not re-created.
  return view(function* () {
    return (
      <Router>
        {props => (
          <>
            {Nav()}
            {Loading({
              fallback: function* () {
                return <div class="news-list-nav">Loading...</div>;
              },
              children: function* () {
                return <>{props.children}</>;
              }
            })}
          </>
        )}
      </Router>
    );
  });
});

export default App;
