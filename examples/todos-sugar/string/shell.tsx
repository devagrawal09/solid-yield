"use yield";
import { HydrationScript } from "@solidjs/web";
import { App } from "../src/app";
export function Shell() {
  return (
    <html>
      <head>
        <title>Todos sugar</title>
        <HydrationScript />
      </head>
      <body>
        <div id="root">{App()}</div>
      </body>
    </html>
  );
}
