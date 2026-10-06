/**
 * D-102: `foreign(Page, { provided: [Ctx] })` — the author states that a
 * provider sits above the foreign edge (an app-wide `Ctx.provide` around a
 * router). The type takes the requirement off; the runtime checks the claim
 * where the page is created: with the provider above, the page reads it;
 * without one, its setup's read is `NO_PROVIDER` (development) or Solid's
 * own context error (production), at the page's creation.
 *
 * The router here is plain Solid: a function component that renders the
 * component value its route table gives for the current path (what
 * `@solidjs/router` does with `defineRoute({ component })`), so no type
 * carries the page's requirement through it.
 */
import { createComponent, createSignal, flush, resetErrorHalt, type Component } from "solid-js";
import { component, createContext, foreign, perform, render, view } from "solid-yield";

declare const __DEV__: boolean;

let root: HTMLDivElement;
let dispose: (() => void) | undefined;
beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  root.remove();
  resetErrorHalt();
});
function mount(App: () => any) {
  dispose = render(App as any, root);
  flush();
}

type Theme = "light" | "dark";
const ThemeCtx = createContext<Theme, "ThemeCtx">();

const Settings = component(function* Settings() {
  const theme = yield* ThemeCtx;
  return view(function* () {
    return <p>theme: {perform(theme)}</p>;
  });
});

/** A plain Solid router: renders the component its table gives for the path. */
const [path, setPath] = createSignal("/settings");
function Router(props: { routes: Record<string, Component<{}>> }) {
  return () => {
    const page = props.routes[path()];
    return page ? createComponent(page, {}) : null;
  };
}
const routes = { "/settings": foreign(Settings, { provided: [ThemeCtx] }) };

describe("D-102: foreign(Comp, { provided }) — a provider above the foreign edge", () => {
  it("the provider above the router reaches the routed page", () => {
    const App = component(function* App() {
      return view(function* () {
        return (
          <main>
            {perform(
              ThemeCtx.provide({
                value: "dark",
                children: function* () {
                  return <Router routes={routes} />;
                }
              })
            )}
          </main>
        );
      });
    });
    setPath("/settings");
    flush();
    mount(App);
    expect(root.textContent).toBe("theme: dark");
  });

  it("the claim is checked where the page is created: no provider above is NO_PROVIDER", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => mount(() => <Router routes={routes} />)).toThrow(
        __DEV__
          ? /\[NO_PROVIDER\] <Settings> reads a context, created without a default/
          : /context/i
      );
    } finally {
      error.mockRestore();
    }
  });
});
