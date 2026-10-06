/**
 * getting-started's app-shell recipe, run against `@solidjs/router`: a
 * parameterized route registered with `defineRoute` renders its page with
 * the params from the URL, beside a bare-object route under an app-wide
 * context. The types half is router.type-tests.tsx.
 */
import { createRouter, defineRoute, type RouteProps } from "@solidjs/router";
import { flush } from "solid-js";
import { component, createContext, foreign, Loading, render, view, type Props } from "solid-yield";

type Theme = "light" | "dark";
const ThemeCtx = createContext<Theme, "ThemeCtx">(undefined, { name: "ThemeCtx" });

const Notes = component(function* Notes(props: Props<RouteProps<"/notes/:mode">>) {
  return view(function* () {
    return <h1 class="notes">notes: {yield* props.params.mode}</h1>;
  });
});

const Settings = component(function* Settings() {
  const theme = yield* ThemeCtx;
  return view(function* () {
    return <p class="theme">theme: {yield* theme}</p>;
  });
});

const Router = createRouter({
  routes: [
    defineRoute({ path: "/notes/:mode", component: foreign(Notes) }),
    { path: "/settings", component: foreign(Settings, { provided: [ThemeCtx] }) }
  ]
});

const App = component(function* App() {
  return view(function* () {
    return (
      <div>
        {
          yield* ThemeCtx.provide({
            value: "light",
            children: function* () {
              return (
                <Router>
                  {props =>
                    Loading({
                      fallback: function* () {
                        return <p>Loading…</p>;
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
      </div>
    );
  });
});

let root: HTMLDivElement;
let dispose: (() => void) | undefined;
beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  root.remove();
  vi.restoreAllMocks();
  history.replaceState(null, "", "/");
});

async function settle() {
  flush();
  await new Promise(r => setTimeout(r, 0));
  flush();
}

describe("the app-shell recipe on @solidjs/router", () => {
  it("a defineRoute page reads its params from the URL", async () => {
    history.replaceState(null, "", "/notes/archived");
    dispose = render(App, root);
    await settle();
    expect(root.querySelector(".notes")!.textContent).toBe("notes: archived");
  });

  it("a bare-object route beside it reads the app-wide context", async () => {
    history.replaceState(null, "", "/settings");
    dispose = render(App, root);
    await settle();
    expect(root.querySelector(".theme")!.textContent).toBe("theme: light");
  });
});
