// The app root (examples/room's, as a yield component): a router over routes.ts,
// under the tab's identity. The tree is built by the view (JSX only in a
// view, D-041); a view runs once (D-032), so the router is not re-created.
import { createRouter } from "@solidjs/router";
import { component, Loading, view } from "solid-yield";
import { IdentityProvider } from "~/lib/identity";
import { routes } from "~/routes";
import "./app.css";

const Router = createRouter({ routes });

const App = component(function* App() {
  return view(function* () {
    return (
      <>
        {
          yield* IdentityProvider({
            children: function* () {
              return (
                <Router>
                  {props =>
                    Loading({
                      fallback: function* () {
                        return <div class="room muted">Loading…</div>;
                      },
                      children: function* () {
                        return <>{props.children}</>;
                      }
                    })
                  }
                </Router>
              );
            }
          })
        }
      </>
    );
  });
});

export default App;
