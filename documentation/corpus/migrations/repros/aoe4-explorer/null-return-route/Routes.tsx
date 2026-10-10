import { createRouter, defineRoutes, useNavigate } from "@solidjs/router";
import { onSettled } from "solid-js";
import { render } from "@solidjs/web";
// A redirect route component that renders nothing.
function CivsRedirect() {
  const navigate = useNavigate();
  onSettled(() => navigate("/"));
  return null;
}
function Home() {
  return <main>home</main>;
}
const Router = createRouter({ routes: defineRoutes([{ path: "/", component: Home }, { path: "/civs", component: CivsRedirect }]) });
render(() => <Router>{(r) => <div>{r.children}</div>}</Router>, document.body);
