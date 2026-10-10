import { createRouter, defineRoutes } from "@solidjs/router";
import { createMemo, Errored, Loading } from "solid-js";
import { render } from "@solidjs/web";
function Home() {
  const data = createMemo(async () => {
    const r = await fetch("/x");
    return r.text();
  });
  return <main>{data()}</main>;
}
const Router = createRouter({ routes: defineRoutes([{ path: "/", component: Home }]) });
function App() {
  return (
    <Router>
      {(r) => (
        <Errored fallback={<p>error</p>}>
          <Loading fallback={<p>loading</p>}>{r.children}</Loading>
        </Errored>
      )}
    </Router>
  );
}
render(() => <App />, document.body);
