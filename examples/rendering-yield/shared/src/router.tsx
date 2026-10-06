// The example's tiny router (examples/rendering's, as yield components): the location
// is a `$signal` provided through context; `Link` navigates with an `$event`.
import {
  component,
  $event,
  $memo,
  $signal,
  createContext,
  type Setter,
  type Component,
  type Element,
  type Source,
  type Props,
  view
} from "solid-yield";
import { isServer } from "@solidjs/web";

export interface RouterValue {
  location: Source<string>;
  setLocation: Setter<string>;
}

/**
 * The router's location, for the components below `RouteHOC`. Outside a
 * router there is none (the original throws): created without a default, a
 * component that reads it requires it (D-098), and `RouteHOC` provides it
 * around its page's call; a page rendered without one is refused by the
 * types, and `NO_PROVIDER` at run time.
 */
const RouterContext = createContext<RouterValue, "RouterContext">();

/**
 * The routed component: its requirements (`R`) pass on, less the router's,
 * which this provides.
 */
function RouteHOC<P extends boolean, E, W extends boolean, R>(Comp: Component<{}, P, E, W, R>) {
  return component(function* Router(props: Props<{ url?: string }>) {
    // The location the router navigated to, or none yet: then the URL a
    // server render starts from (a prop: read where the location is derived,
    // D-042), else the document's.
    const [navigated, setLocation] = yield* $signal<string | undefined>(undefined);
    const location = yield* $memo(function* () {
      const path = yield* navigated;
      if (path !== undefined) return path;
      const url = yield* props.url;
      return (url ?? (isServer ? "/" : window.location.pathname)).slice(1) || "index";
    });

    if (!isServer) {
      window.onpopstate = $event(function* () {
        yield* setLocation(window.location.pathname.slice(1) || "index");
      });
    }

    return view(function* () {
      return (
        <>
          {
            yield* RouterContext.provide({
              value: { location, setLocation },
              children: function* () {
                return <>{yield* Comp()}</>;
              }
            })
          }
        </>
      );
    });
  });
}

/**
 * The router, read in a setup: the location (a path, read like a prop,
 * D-042), the setter (a source of it: read it in the event that calls it),
 * and `yield* matches("profile")`, whether that route is current (read
 * where it is delegated to).
 */
function* useRouter() {
  const router = yield* RouterContext;
  return {
    location: router.location,
    setLocation: router.setLocation,
    *matches(match: string) {
      return match === ((yield* router.location) || "index");
    }
  };
}

const Link = component(function* Link(props: Props<{ path: string; children: Element }>) {
  const { setLocation } = yield* useRouter();
  const navigate = $event(function* (event: MouseEvent) {
    event.preventDefault();
    const path = yield* props.path;
    window.history.pushState("", "", `/${path}`);
    yield* (yield* setLocation)(path);
  });
  return view(function* () {
    return (
      <a class="link" href={`/${yield* props.path}`} onClick={yield* navigate}>
        {yield* props.children}
      </a>
    );
  });
});

export { Link, RouteHOC, RouterContext, useRouter };
