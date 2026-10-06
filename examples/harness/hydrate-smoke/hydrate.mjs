#!/usr/bin/env node
// The gate's twin-hydration smoke step. Each case renders a twin's route on
// the server as the server-render smoke does (Vite's SSR loader, development
// builds), then hydrates that document in jsdom with the twin's own client
// entry, compiled for the DOM (hydratable) by the same Vite server.
//
// A case passes when:
// - the server render ends with a document and no development error;
// - hydration claims it: no hydration mismatch, no `[CODE]` development error
//   (solid-yield's or Solid's) logged or thrown, no unhandled rejection, and
//   the server's nodes are still the document's after hydration (the app
//   claimed them; it did not re-render them);
// - where the case names one, an interaction works afterwards (a click whose
//   result the case checks).
//
// How: one Vite server per case, with the twin's config and one more
// environment, `hydrate` (consumer "client", runnable): the SSR environment
// renders, `hydrate` compiles the client entry for the DOM and runs it in
// this process. jsdom's window is put on Node's global the way Vitest's jsdom
// environment does (`populateGlobal`), so the server's inline scripts (the
// `_$HY` bootstrap, the streamed chunks) and Solid's client read the same
// global. Each case runs in its own process, killed after TIMEOUT_MS: 30 s, or
// 120 s on GitHub Actions (GITHUB_ACTIONS; not CI, which the gate sets on every
// run), whose runners are several times slower than a laptop (hackernews' story,
// ~2.5 s here, ran past 30 s there); SMOKE_TIMEOUT_MS overrides both. A case
// that times out names the step it was in (start, render, hydrate, interact).
//
// Usage: node examples/harness/hydrate-smoke/hydrate.mjs [--only <substring>] [--jobs <n>] [--originals]
// (HYDRATE_SMOKE_VERBOSE=1 passes the cases' console through; HYDRATE_SMOKE_DUMP=<file>
// writes a case's server document, with --only one case)
// Exit code 0 when every case passes.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const self = fileURLToPath(import.meta.url);
const examples = join(dirname(self), "..", "..");
const TIMEOUT_MS =
  Number(process.env.SMOKE_TIMEOUT_MS) || (process.env.GITHUB_ACTIONS ? 120_000 : 30_000);

/**
 * Interactions, by name: each runs after hydration and returns an error
 * string, or nothing when the page responded.
 */
const INTERACTIONS = {
  /** rendering /settings: the portal's close button removes the portal. */
  async "close the portal"(document, settle) {
    const button = [...document.querySelectorAll("button")].find(
      b => b.textContent.trim() === "Close portal"
    );
    if (!button) return "no Close portal button";
    if (!document.querySelector(".modal-card")) return "the portal is not open";
    button.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
    await settle();
    if (document.querySelector(".modal-card")) return "the portal is still open after the click";
  }
};

/**
 * One entry per server entry, as the server-render smoke has them: its kind
 * (rendering's own `entry-server.tsx` / `client.tsx`, or @solidjs/vite-plugin's
 * generated `handler`, whose client entry the document names), its routes and
 * their interactions.
 */
const TARGETS = [
  ...["string", "stream"].map(entry => ({
    twin: "rendering-yield",
    entry,
    kind: "entry",
    urls: ["/", "/profile", "/settings", "/stream", "/error-stream", "/reveal", "/skeleton"],
    interactions: { "/settings": "close the portal" }
  })),
  { twin: "room-yield", entry: "handler", kind: "handler", urls: ["/live"] },
  {
    twin: "hackernews-spa-yield",
    entry: "handler",
    kind: "handler",
    urls: ["/stories/30186326"]
  }
];

/**
 * Known failures: a twin's case that fails, by name, with the message it must
 * keep failing with, where its original (`--originals`) hydrates clean. A
 * case that starts to pass fails the step until it is removed here, so a fix
 * is recorded. Empty since D-092: the five found when this step was added
 * (rendering's streamed `/profile`, `/stream`, `/error-stream`, room's
 * `/live`, hackernews' story) were all a call-form fallback written as JSX,
 * built with the holding view and claiming, while hydrating, a server node
 * the server never rendered.
 */
const KNOWN_FAILURES = {};

/** A development error: `[READ_IN_VIEW] …`, `[HYDRATION_MISMATCH] …`. */
const DEV_ERROR = /\[([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\]/;
/** Solid's hydration complaints that carry no `[CODE]`. */
const HYDRATION = /hydrat/i;

// --- child: one case ---------------------------------------------------------------

/**
 * Vite's HMR client, which client modules import for `import.meta.hot`: there
 * is no websocket here (and no updates), so the `hydrate` environment gets an
 * inert one.
 */
/** The jsdom page's origin. */
const ORIGIN = "http://localhost";
const noHmrClient = {
  name: "hydrate-smoke:no-hmr-client",
  enforce: "pre",
  applyToEnvironment: environment => environment.name === "hydrate",
  load(id) {
    if (!/\/vite\/dist\/client\/client\.mjs$/.test(id.replace(/\?.*$/, ""))) return;
    return [
      "const hot = { data: {}, accept() {}, acceptExports() {}, dispose() {}, prune() {}, decline() {}, invalidate() {}, on() {}, off() {}, send() {} };",
      "export const createHotContext = () => hot;",
      "export const updateStyle = () => {};",
      "export const removeStyle = () => {};",
      "export const injectQuery = url => url;",
      "export class ErrorOverlay {}"
    ].join("\n");
  }
};

async function hydrateOne(twin, entry, kind, url, interaction) {
  const dir = join(examples, twin);
  const require = createRequire(join(dir, "package.json"));
  const vite = await import(pathToFileURL(require.resolve("vite")).href);
  // jsdom and Vitest's populateGlobal from a twin that has them (an original may not)
  const tools = createRequire(join(examples, "rendering-yield", "package.json"));
  const { JSDOM } = tools("jsdom");
  const { populateGlobal } = await import(pathToFileURL(tools.resolve("vitest/runtime")).href);
  const logged = [];
  let phase = "render";
  for (const level of ["error", "warn"]) {
    const original = console[level];
    console[level] = (...args) => {
      logged.push(
        `${phase}: ${args.map(a => (a instanceof Error ? a.message : String(a))).join(" ")}`
      );
      if (process.env.HYDRATE_SMOKE_VERBOSE) original(...args);
    };
  }
  console.log = () => {};
  // the step a case is in, for the parent to name if it kills the case
  const step = name => process.stdout.write(`\nstep ${name}\n`);
  step("start");
  const report = result => {
    process.stdout.write("\n" + JSON.stringify(result) + "\n");
    process.exit(0);
  };
  // A rejection is a failure only if nothing ever handles it: a streamed
  // server failure is a promise the server's inline script rejects before the
  // client has loaded, and hydration handles it (Node then reports
  // `rejectionHandled`), as a browser's `rejectionhandled` follows its
  // `unhandledrejection`.
  const unhandled = new Map();
  process.on("unhandledRejection", (e, promise) =>
    unhandled.set(promise, `${phase}: unhandled rejection: ${e?.message ?? e}`)
  );
  process.on("rejectionHandled", promise => unhandled.delete(promise));
  const rejections = () => [...unhandled.values()];
  process.on("uncaughtException", e => logged.push(`${phase}: uncaught: ${e?.message ?? e}`));

  const server = await vite.createServer({
    ...(kind === "entry"
      ? { configFile: join(dir, entry, "vite.config.mjs"), root: join(dir, entry) }
      : { root: dir }),
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [noHmrClient],
    environments: {
      hydrate: {
        consumer: "client",
        optimizeDeps: { noDiscovery: true, include: [] },
        dev: {
          // import → the runner's own, as for a server environment
          moduleRunnerTransform: true,
          createEnvironment: (name, config) =>
            vite.createRunnableDevEnvironment(name, config, { runnerOptions: { hmr: false } })
        }
      }
    }
  });

  // Solid preloads a hydrating page's lazy modules with `import(new
  // URL(path, document.baseURI))`; the page's origin is this server, and the
  // runner would hand an `http:` URL to Node as an external module
  const hydrateEnv = server.environments.hydrate;
  const fetchModule = hydrateEnv.fetchModule.bind(hydrateEnv);
  hydrateEnv.fetchModule = (id, ...rest) =>
    fetchModule(id.startsWith(ORIGIN + "/") ? id.slice(ORIGIN.length) : id, ...rest);

  // 1. the server render
  step("render");
  let html;
  try {
    if (kind === "entry") {
      const mod = await server.ssrLoadModule("/entry-server.tsx");
      html = String(await mod.render(url));
    } else {
      const handler = await server.environments.ssr.runner.import("virtual:solid-ssr-handler");
      const response = await handler.handleRequest(
        new Request(`${ORIGIN}${url}`, { headers: { accept: "text/html" } }),
        { pageRequest: true, devHead: "" }
      );
      html = await response.text();
      if (response.status !== 200) return report({ failed: `status ${response.status}` });
    }
  } catch (e) {
    return report({ failed: `render threw: ${String(e?.message ?? e).split("\n")[0]}` });
  }
  await new Promise(r => setTimeout(r, 50));
  // a diagnosis aid: HYDRATE_SMOKE_DUMP=<file> writes the server's document
  if (process.env.HYDRATE_SMOKE_DUMP) writeFileSync(process.env.HYDRATE_SMOKE_DUMP, html);
  const renderError = logged.find(m => DEV_ERROR.test(m));
  if (renderError) return report({ failed: `development error: ${renderError.split("\n")[0]}` });
  if (!html.trim()) return report({ failed: "empty document" });

  // 2. the document in jsdom, its inline scripts run as a browser runs them
  phase = "hydrate";
  step("hydrate");
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    url: `${ORIGIN}${url}`,
    pretendToBeVisual: true
  });
  populateGlobal(globalThis, dom.window, { bindFunctions: true });
  const { document } = dom.window;
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  const parsed = new dom.window.DOMParser().parseFromString(
    html.replace(scriptRe, (all, attrs) => (/\bsrc=/.test(attrs) ? all : "")),
    "text/html"
  );
  document.replaceChild(
    document.importNode(parsed.documentElement, true),
    document.documentElement
  );
  for (const [, attrs, body] of html.matchAll(scriptRe)) {
    if (/\bsrc=/.test(attrs) || /type=["']?module/.test(attrs) || !body.trim()) continue;
    try {
      (0, eval)(body);
    } catch (e) {
      return report({ failed: `a server script threw: ${String(e?.message ?? e)}` });
    }
  }
  // the server's nodes, to check that hydration claimed rather than replaced
  // them: the body's top-level elements must be the client's afterwards (a
  // re-render or an abandoned hydration replaces them). Inside, a `Loading`
  // fallback is legitimately replaced by its content once it resolves (the
  // string entry renders every page as its fallback), so finer mismatches are
  // left to Solid's own development diagnostics ("Hydration key miss" …),
  // which fail the case above.
  const isMarkup = n => n.tagName !== "SCRIPT" && n.tagName !== "TEMPLATE";
  const serverNodes = [...document.body.querySelectorAll("*")].filter(isMarkup);
  const serverRoots = [...document.body.children].filter(isMarkup);

  // 3. the client entry, compiled for the DOM, hydrates the document. A
  // generated entry is the document's module script (`/@id/virtual:…`).
  const clientEntry =
    kind === "entry"
      ? "/client.tsx"
      : [...html.matchAll(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/g)]
          .map(m => m[1])
          .find(src => src !== "/@vite/client")
          ?.replace(/^\/@id\//, "");
  if (!clientEntry) return report({ failed: "the document names no client entry" });
  // The network is held: a request never settles, as over a stalled
  // connection. Server functions (room's live sources, its posts) are served
  // by Vite's middleware, which needs a listening server; this checks the
  // hydration of what the server sent, not what the client fetches next.
  globalThis.fetch = () => new Promise(() => {});
  const settle = async () => {
    for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r, 20));
  };
  try {
    await server.environments.hydrate.runner.import(clientEntry);
  } catch (e) {
    return report({
      failed: `client threw: ${String(e?.stack ?? e)
        .split("\n")
        .slice(0, 6)
        .join(" / ")}`
    });
  }
  // claimed, not replaced: hydration is synchronous for what the server
  // rendered; what settles later (a `Loading` fallback's content, a streamed
  // chunk) may legitimately replace a fallback, so it is counted before
  const kept = serverRoots.filter(n => n.isConnected).length;
  const claimed = serverNodes.filter(n => n.isConnected).length;
  await settle();
  const hydrateError = logged.find(
    m => m.startsWith("hydrate:") && (DEV_ERROR.test(m) || HYDRATION.test(m))
  );
  if (hydrateError) return report({ failed: hydrateError.split("\n")[0] });
  const otherError =
    logged.find(m => m.startsWith("hydrate:")) ?? rejections().find(m => m.startsWith("hydrate:"));
  if (otherError) return report({ failed: otherError.split("\n")[0] });
  // a node the client replaced is disconnected
  if (kept < serverRoots.length)
    return report({
      failed: `hydration replaced ${serverRoots.length - kept} of the body's ${serverRoots.length} server elements`
    });

  // 4. one interaction
  phase = "interact";
  if (interaction) {
    step("interact");
    const problem = await INTERACTIONS[interaction](document, settle);
    if (problem) return report({ failed: `${interaction}: ${problem}` });
    await settle();
    const after =
      logged.find(m => m.startsWith("interact:")) ??
      rejections().find(m => m.startsWith("interact:"));
    if (after) return report({ failed: after.split("\n")[0] });
  }
  await server.close();
  report({ claimed, nodes: serverNodes.length, interaction: interaction || null });
}

// --- parent: every case, each in its own process -----------------------------------

function runOne(target, url) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      [
        self,
        "--one",
        target.twin,
        target.entry,
        target.kind,
        url,
        target.interactions?.[url] ?? ""
      ],
      {
        // room's dev config serves HTTPS unless HTTPS=0; nothing listens here
        env: { ...process.env, HTTPS: "0" },
        stdio: ["ignore", "pipe", process.env.HYDRATE_SMOKE_VERBOSE ? "inherit" : "ignore"]
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
        const steps = [...stdout.matchAll(/^step (\w+)$/gm)];
        const during = steps.length ? ` (during ${steps.at(-1)[1]})` : "";
        resolve({ failed: `no end after ${TIMEOUT_MS / 1000} s${during}`, ms });
      }
    });
  });
}

if (process.argv[2] === "--one") {
  await hydrateOne(...process.argv.slice(3, 8));
} else {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  // --originals: the same cases against each twin's original (a diagnosis aid,
  // not gated): a failure both share is not the library's
  const originals = args.includes("--originals");
  const jobs = args.includes("--jobs") ? Number(args[args.indexOf("--jobs") + 1]) : 4;
  const cases = TARGETS.map(t =>
    originals ? { ...t, twin: join("originals", t.twin.replace(/-yield(-h)?$/, "")) } : t
  )
    .flatMap(t => t.urls.map(url => ({ t, url })))
    .map(c => ({ ...c, name: `${c.t.twin} ${c.t.entry} ${c.url}` }))
    .filter(c => !only || c.name.includes(only));
  const results = new Map();
  const queue = cases.slice();
  await Promise.all(
    Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      for (let c; (c = queue.shift()); ) results.set(c, await runOne(c.t, c.url));
    })
  );
  const width = Math.max(...cases.map(c => c.name.length));
  let failures = 0;
  let known = 0;
  for (const c of cases) {
    const res = results.get(c);
    const expected = originals ? undefined : KNOWN_FAILURES[c.name];
    let status = res.failed ? "FAIL" : "ok  ";
    let what = res.failed
      ? res.failed.slice(0, 220)
      : `${res.claimed} / ${res.nodes} server nodes claimed${res.interaction ? `; ${res.interaction}` : ""}`;
    if (expected && res.failed?.includes(expected)) {
      status = "KNOWN";
      known++;
    } else if (expected) {
      what = res.failed
        ? `a known failure failed differently: ${what}`
        : `a known failure now passes (${what}): remove it from KNOWN_FAILURES`;
      status = "FAIL";
    }
    if (status === "FAIL") failures++;
    console.log(
      `${status.padEnd(5)} ${c.name.padEnd(width)}  ${String(res.ms).padStart(6)} ms  ${what}`
    );
  }
  console.log(
    `\n${cases.length - failures - known} / ${cases.length} hydrations pass${known ? `, ${known} known failures as recorded` : ""}${failures ? `, ${failures} failing` : ""}`
  );
  process.exit(failures ? 1 : 0);
}
