"use yield";
import { createRouter } from "@solidjs/router";
import { Loading } from "solid-yield";
import { IdentityProvider } from "~/lib/identity";
import { routes } from "~/routes";
import "./app.css";
const Router = createRouter({ routes });
const App = function App() {
  return (
    <>
      {IdentityProvider({
        children: function () {
          return (
            <Router>
              {props =>
                Loading({
                  fallback: function () {
                    return <div class="room muted">Loading…</div>;
                  },
                  children: function () {
                    return <>{props.children}</>;
                  }
                })
              }
            </Router>
          );
        }
      })}
    </>
  );
};
export default App;
