import { render } from "@solidjs/web";
import { createRouter, defineRoute } from "@solidjs/router";
import { Home } from "./Home";
import SessionPage from "./SessionPage";
import SafeSessionPage from "./SafeSessionPage";

// opencode-style routing with the Router 2.0 API: a session list at "/", one session per route.
const Router = createRouter({
  routes: [
    defineRoute({ path: "/", component: Home }),
    defineRoute({ path: "/session/:id", component: SessionPage }),
    defineRoute({ path: "/safe/:id", component: SafeSessionPage }),
  ],
});

function App() {
  return <Router>{(props) => <main>{props.children}</main>}</Router>;
}

render(() => <App />, document.getElementById("root")!);
