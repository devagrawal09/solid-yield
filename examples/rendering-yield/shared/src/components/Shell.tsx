import { component, type Element, type Failure, type Props, type Source, view } from "solid-yield";
import { HydrationScript } from "@solidjs/web";

/**
 * SSR-only shell. Wraps the shared `<App />` content in an `<html>` document
 * with hydration script, stylesheet, and the client entry module. The CSR
 * variant serves its own static `index.html` and does not use this.
 *
 * `clientEntry` is the dev module path of the mode's client entry (e.g.
 * `/client.tsx`); in production builds the server harness rewrites it to the
 * hashed asset from the Vite client manifest.
 *
 * Its `children` (the app, under the root's `Loading`) may fail: the
 * failures pass on to the root, where they are re-thrown (D-033), as in the
 * original (D-029: a generic forwards each caller's color).
 */
const Shell = component(function* Shell<E extends Failure>(
  props: Props<{ clientEntry: string; children: Source<Element, E> }>
) {
  return view(function* () {
    return (
      <html lang="en">
        <head>
          <title>🔥 Solid Rendering 🔥</title>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" href="/styles.css" />
          <HydrationScript />
        </head>
        <body>
          <div id="app">{yield* props.children}</div>
        </body>
        <script type="module" src={yield* props.clientEntry} async></script>
      </html>
    );
  });
});

export default Shell;
