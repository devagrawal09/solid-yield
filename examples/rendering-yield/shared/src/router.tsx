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
const RouterContext = createContext<RouterValue, "RouterContext">(undefined, {
  name: "RouterContext"
});

/**
 * The routed component: its requirements (`R`) pass on, less the router's,
 * which this provides.
 */
function RouteHOC<P extends boolean, E, W extends boolean, R>(Comp: Component<{}, P, E, W, R>) {
  return component(function* Router(props: Props<{ url?: string }>) {
    // The location the router navigated to, or none yet: then the URL a
    // server render starts from (a held prop, D-126), else the document's.
    const [navigated, setLocation] = yield* $signal<string | undefined>(undefined);
    const location = yield* $memo(function* () {
      const path = yield* navigated;
      if (path !== undefined) return path;
      const url = props.url;
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
 * The router, read in a setup: its value is a bag, held as it is (D-126) —
 * the location (a source, read where it is read), the setter (called in the
 * event that writes), and `yield* matches("profile")`, whether that route is
 * current (read where it is delegated to).
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
    const path = props.path;
    window.history.pushState("", "", `/${path}`);
    yield* setLocation(path);
  });
  return view(function* () {
    return (
      <a class="link" href={`/${props.path}`} onClick={yield* navigate}>
        {yield* props.children}
      </a>
    );
  });
});

export { Link, RouteHOC, RouterContext, useRouter };
