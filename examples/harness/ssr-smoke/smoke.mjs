#!/usr/bin/env node
// The gate's server-render smoke step: every twin with a server entry renders
// each of its routes on the server, through Vite's SSR loader (development
// builds, as `vite dev` serves them). Nothing is compared: a render passes if
// it ends, without a throw and without a development error.
//
// - rendering-yield: its own SSR entries, `string/entry-server.tsx`
//   (`renderToString`) and `stream/entry-server.tsx` (`renderToStream`,
//   awaited to its end), for every route of its router.
// - room-yield, hackernews-spa-yield: @solidjs/vite-plugin's generated
//   server entry (`virtual:solid-ssr-handler`), one page request each.
//   hackernews' feed and user routes read the live HN API, so only the story
//   it serves from its checked-in capture is rendered (no network in the
//   gate).
//
// Each render runs in its own process and is killed after TIMEOUT_MS: a render
// that never ends (rendering's streamed /profile before its fix spun in
// microtasks and starved every timer, its own included) fails as a timeout.
//
// A failure is: a throw out of the render; a non-200 response; an empty
// document; a development error — a `[CODE]` message (solid-yield's or
// Solid's) logged with console.error / console.warn, raised as an unhandled
// rejection, or written into the document; or no end within TIMEOUT_MS.
//
// Usage: node examples/harness/ssr-smoke/smoke.mjs [--only <substring>] [--jobs <n>]
// Exit code 0 when every render passes.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);
const examples = join(dirname(self), "..", "..");
const TIMEOUT_MS = 30_000;

/** One entry per server entry: how to render it, and its routes. */
const TARGETS = [
  ...["string", "stream"].map(entry => ({
    twin: "rendering-yield",
    entry,
    kind: "entry",
    urls: ["/", "/profile", "/settings", "/stream", "/error-stream", "/reveal", "/skeleton"]
  })),
  { twin: "room-yield", entry: "handler", kind: "handler", urls: ["/live"] },
  {
    twin: "hackernews-spa-yield",
    entry: "handler",
    kind: "handler",
    urls: ["/stories/30186326"]
  }
];

/** A development error: `[READ_IN_VIEW] …`, `[SSR_RENDER_ERROR_CONTAINED] …`. */
const DEV_ERROR = /\[([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\]/;

// --- child: one render -------------------------------------------------------------

async function renderOne(twin, entry, kind, url) {
  const dir = join(examples, twin);
  const require = createRequire(join(dir, "package.json"));
  const { createServer } = await import(require.resolve("vite"));
  const logged = [];
  for (const level of ["error", "warn"]) {
    const original = console[level];
    console[level] = (...args) => {
      logged.push(args.map(a => (a instanceof Error ? a.message : String(a))).join(" "));
      if (process.env.SSR_SMOKE_VERBOSE) original(...args);
    };
  }
  console.log = () => {};
  process.on("unhandledRejection", e => logged.push(`unhandled rejection: ${e?.message ?? e}`));
  const server = await createServer({
    ...(kind === "entry"
      ? { configFile: join(dir, entry, "vite.config.mjs"), root: join(dir, entry) }
      : { root: dir }),
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false }
  });
  let html = "";
  let failed = null;
  try {
    if (kind === "entry") {
      const mod = await server.ssrLoadModule("/entry-server.tsx");
      // the stream is a thenable that resolves to the whole document
      html = String(await mod.render(url));
    } else {
      const handler = await server.environments.ssr.runner.import("virtual:solid-ssr-handler");
      const response = await handler.handleRequest(
        new Request(`http://localhost${url}`, { headers: { accept: "text/html" } }),
        { pageRequest: true, devHead: "" }
      );
      html = await response.text();
      if (response.status !== 200) failed = `status ${response.status}`;
    }
  } catch (e) {
    failed = `threw: ${String(e?.message ?? e).split("\n")[0]}`;
  }
  // let a rejection or a log that follows the end of the render land
  await new Promise(r => setTimeout(r, 50));
  if (!failed) {
    // a development error names the cause, so it is reported before its effects
    const devError = logged.find(m => DEV_ERROR.test(m));
    const rejection = logged.find(m => m.startsWith("unhandled rejection"));
    if (devError) failed = `development error: ${devError.split("\n")[0]}`;
    else if (rejection) failed = rejection;
    else if (DEV_ERROR.test(html))
      failed = `development error in the document: ${html.match(DEV_ERROR)[0]}`;
    else if (!html.trim()) failed = "empty document";
  }
  process.stdout.write("\n" + JSON.stringify(failed ? { failed } : { bytes: html.length }) + "\n");
  process.exit(0);
}

// --- parent: every render, each in its own process ---------------------------------

function runOne(target, url) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      [self, "--one", target.twin, target.entry, target.kind, url],
      {
        // room's dev config serves HTTPS unless HTTPS=0; nothing listens here
        env: { ...process.env, HTTPS: "0" },
        stdio: ["ignore", "pipe", process.env.SSR_SMOKE_VERBOSE ? "inherit" : "ignore"]
      }
    );
    let stdout = "";
    child.stdout.on("data", c => void (stdout += c));
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.on("close", () => {
      clearTimeout(timer);
      const ms = Date.now() - started;
      try {
        resolve({ ...JSON.parse(stdout.trim().split("\n").pop()), ms });
      } catch {
        resolve({ failed: `no end after ${TIMEOUT_MS / 1000} s`, ms });
      }
    });
  });
}

if (process.argv[2] === "--one") {
  await renderOne(...process.argv.slice(3, 7));
} else {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const jobs = args.includes("--jobs") ? Number(args[args.indexOf("--jobs") + 1]) : 4;
  const renders = TARGETS.flatMap(t => t.urls.map(url => ({ t, url })))
    .map(r => ({ ...r, name: `${r.t.twin} ${r.t.entry} ${r.url}` }))
    .filter(r => !only || r.name.includes(only));
  const results = new Map();
  const queue = renders.slice();
  await Promise.all(
    Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      for (let r; (r = queue.shift()); ) results.set(r, await runOne(r.t, r.url));
    })
  );
  const width = Math.max(...renders.map(r => r.name.length));
  let failures = 0;
  for (const r of renders) {
    const res = results.get(r);
    if (res.failed) failures++;
    const what = res.failed ? res.failed.slice(0, 200) : `${res.bytes} chars`;
    console.log(
      `${res.failed ? "FAIL" : "ok  "}  ${r.name.padEnd(width)}  ${String(res.ms).padStart(6)} ms  ${what}`
    );
  }
  console.log(`\n${renders.length - failures} / ${renders.length} server renders pass`);
  process.exit(failures ? 1 : 0);
}
