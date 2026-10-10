import { createContext, createMemo, createSignal, useContext, type Component } from "solid-js";

// F-S52: a context value declared with plain function types, given a source,
// a setter and a routine; F-S45: a tuple, read through destructuring.
type RouterValue = [() => string, { go: (path: string) => void; is: (path: string) => boolean }];

const RouterContext = createContext<RouterValue>();

// F-S51: a component factory; its component closes over the page.
export function withRouter(Page: Component): Component<{ url?: string }> {
  return (props = {}) => {
    const [navigated, go] = createSignal<string>();
    const path = createMemo(() => navigated() ?? props.url ?? "/");
    const is = (match: string) => match === path();
    window.onpopstate = () => go(location.pathname);
    return (
      <RouterContext value={[path, { go, is }]}>
        <Page />
      </RouterContext>
    );
  };
}

export function useRouter() {
  const router = useContext(RouterContext);
  if (!router) throw new Error("no router");
  return router;
}

export function Link(props: { to: string; label: string }) {
  const [, { go, is }] = useRouter();
  return (
    <a
      class={{ active: is(props.to) }}
      href={props.to}
      onClick={event => {
        event.preventDefault();
        go(props.to);
      }}
    >
      {props.label}
    </a>
  );
}
