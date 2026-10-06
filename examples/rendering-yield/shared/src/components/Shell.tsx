import { $component, type Element, type Props, view } from "solid-yield";
import { HydrationScript } from "@solidjs/web";

/**
 * SSR-only shell. Wraps the shared `<App />` content in an `<html>` document
 * with hydration script, stylesheet, and the client entry module. The CSR
 * variant serves its own static `index.html` and does not use this.
 *
 * `clientEntry` is the dev module path of the mode's client entry (e.g.
 * `/client.tsx`); in production builds the server harness rewrites it to the
 * hashed asset from the Vite client manifest.
 */
const Shell = $component(function* Shell(props: Props<{ clientEntry: string; children: Element }>) {
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
