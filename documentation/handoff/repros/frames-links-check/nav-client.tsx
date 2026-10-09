// Client-only navigation variants (no server components), for comparing with
// the frames "streamed loading root" behaviour.
import { createMemo, Loading, Show } from "solid-js";
import { dynamic } from "@solidjs/web";
import { createRouter, defineRoute, defineRoutes } from "@solidjs/router";

const wait = async (name: string) => {
  const hold = (globalThis as any)[name];
  if (hold) await hold;
};

function Article(props: { slug: string }) {
  return (
    <article data-page={props.slug}>
      <a class="to-b" href="/page/b">
        B
      </a>
    </article>
  );
}

// A region with its OWN Loading boundary, created per navigation.
function Region(props: { slug: string }) {
  const data = createMemo(async () => {
    const slug = props.slug;
    await wait("holdData");
    return slug;
  });
  return (
    <Loading fallback={<p class="inner">Inner loading</p>}>
      <Article slug={data()} />
    </Loading>
  );
}

const pages: Record<string, (props: any) => any> = {
  // 1. Existing boundary only: async memo directly under the route's Loading.
  reused(props) {
    const data = createMemo(async () => {
      const slug = props.params.slug;
      await wait("holdData");
      return slug;
    });
    return (
      <Loading fallback={<p class="outer">Outer loading</p>}>
        <Article slug={data()} />
      </Loading>
    );
  },
  // 2. New boundary: a new Region (and its inner Loading) per slug, synchronously.
  keyed(props) {
    return (
      <Loading fallback={<p class="outer">Outer loading</p>}>
        <Show when={props.params.slug} keyed>
          {(slug: any) => <Region slug={typeof slug === "function" ? slug() : slug} />}
        </Show>
      </Loading>
    );
  },
  // 3. Mirror of the frames route: loading the component is async (held at the
  //    existing outer boundary), then the component has its own inner Loading.
  dynamic(props) {
    const R = dynamic(() => {
      const slug = props.params.slug;
      return wait("holdModule").then(() => () => <Region slug={slug} />);
    });
    return (
      <Loading fallback={<p class="outer">Outer loading</p>}>
        <R />
      </Loading>
    );
  }
};

export function makeApp(variant: string) {
  const Router = createRouter({
    routes: defineRoutes([defineRoute({ path: "/page/:slug", component: pages[variant] })])
  });
  return () => <Router />;
}
