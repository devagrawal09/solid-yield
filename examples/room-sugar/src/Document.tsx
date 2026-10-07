"use yield";
import { HydrationScript } from "@solidjs/web";
import { type Element, type Props } from "solid-yield";
const Document = function Document(
  props: Props<{
    children?: Element;
  }>
) {
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
      <body>{props.children}</body>
    </html>
  );
};
export default Document;
