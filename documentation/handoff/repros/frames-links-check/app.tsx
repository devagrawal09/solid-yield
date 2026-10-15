import { createMemo, Loading } from "solid-js";
import { dynamic, isServer } from "@solidjs/web";
import { createRouter, defineRoute, defineRoutes } from "@solidjs/router";
import { region } from "./region";
import { Content } from "./content";
function Page(props) {
  if ("__MODE__" === "ordinary") {
    const data = createMemo(async () => {
      const slug = props.params.slug;
      if (!isServer && globalThis.holdData) await globalThis.holdData;
      return slug;
    });
    return (
      <Loading fallback={<main>Loading</main>}>
        <main>
          <Content slug={data()} />
        </main>
      </Loading>
    );
  }
  const Region = dynamic(() => region(props.params.slug));
  return (
    <Loading fallback={<main>Loading</main>}>
      <Region regionRoot="main" />
    </Loading>
  );
}
const Router = createRouter({
  routes: defineRoutes([defineRoute({ path: "/page/:slug", component: Page })])
});
export function App(props) {
  return <Router url={props.url} />;
}
