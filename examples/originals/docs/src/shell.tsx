import { HydrationScript, type JSX } from "@solidjs/web";
export function Shell(props: { children: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Field Notes</title>
        <HydrationScript />
      </head>
      <body>
        <div id="root">{props.children}</div>
      </body>
      <script type="module" src="/client.tsx" async />
    </html>
  );
}
