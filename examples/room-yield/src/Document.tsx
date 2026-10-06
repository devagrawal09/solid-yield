import { HydrationScript } from "@solidjs/web";
import { component, type Element, type Props, view } from "solid-yield";

// The document shell `start` renders the app into (a routine like the rest).
const Document = component(function* Document(props: Props<{ children?: Element }>) {
  return view(function* () {
    return (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="description" content="Solid Room — a live server functions demo" />
          <title>Solid Room</title>
          <link rel="icon" href="/favicon.ico" />
          <HydrationScript />
        </head>
        <body>{yield* props.children}</body>
      </html>
    );
  });
});

export default Document;
