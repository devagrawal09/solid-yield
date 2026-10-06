import { HydrationScript } from "@solidjs/web";
import { component, type Element, type Failure, type Source, type Props, view } from "solid-yield";
export const Shell = component(function* Shell<E extends Failure>(
  props: Props<{ children: Source<Element, E> }>
) {
  return view(function* () {
    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Field Notes</title>
          <HydrationScript />
        </head>
        <body>
          <div id="root">{yield* props.children}</div>
        </body>
        <script type="module" src="/client.tsx" async />
      </html>
    );
  });
});
