#!/usr/bin/env node
// D-082: the cost of the library route's deeper hydration keys (D-069 F5),
// measured on a twin's server output against its original's.
//
// Renders examples/rendering's SSR entries for each URL through Vite's SSR
// loader (development builds, as `vite dev` serves them), once from the twin
// and once from the original, and reports the bytes of the output, the number
// of `_hk` keys, their total and mean length. The markup is the same (the
// parity tests), so the byte difference is the keys' (and what carries a key:
// a `Loading`'s placeholder ids and serialized records).
//
// - `string`: `renderToString`, synchronous; an async route emits its
//   `Loading` fallback.
// - `stream`: `renderToStream`, awaited to its end, so async routes are
//   resolved.
//
// Each render runs in its own process, killed after TIMEOUT_MS: a render that
// fails or does not end is reported as such, not measured.
//
// Usage: node examples/harness/ssr-keys/measure.mjs [--json <path>]
// Manual, outside the gate (D-017).
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);
const examples = join(dirname(self), "..", "..");
const URLS = ["/", "/profile", "/settings", "/stream"];
const ENTRIES = ["string", "stream"];
const TIMEOUT_MS = 30_000;
const PROJECTS = {
  original: join(examples, "originals", "rendering"),
  twin: join(examples, "rendering-yield")
};

/** Child: render one URL, print `{ html }` or `{ failed }` as the last stdout line. */
async function renderOne(dir, entry, url) {
  const require = createRequire(join(dir, "package.json"));
  const { createServer } = await import(require.resolve("vite"));
  const server = await createServer({
    configFile: join(dir, entry, "vite.config.mjs"),
    root: join(dir, entry),
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false }
  });
  const errors = [];
  console.error = (...a) => errors.push(String(a[0]).split("\n")[0]);
  console.log = () => {};
  process.on("unhandledRejection", e => errors.push(String(e?.message ?? e)));
  let out;
  try {
    const mod = await server.ssrLoadModule("/entry-server.tsx");
    // the stream is a thenable that resolves to the whole document
    const html = await mod.render(url);
    out = html && !errors.length ? { html } : { failed: errors[0] ?? "empty output" };
  } catch (e) {
    out = { failed: String(e?.message ?? e).split("\n")[0] };
  }
  process.stdout.write("\n" + JSON.stringify(out) + "\n");
  process.exit(0);
}

function runOne(dir, entry, url) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [self, "--one", dir, entry, url], {
      stdio: ["ignore", "pipe", "ignore"]
    });
    let stdout = "";
    child.stdout.on("data", c => void (stdout += c));
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.on("close", () => {
      clearTimeout(timer);
      const last = stdout.trim().split("\n").pop();
      try {
        resolve(JSON.parse(last));
      } catch {
        resolve({ failed: `no end after ${TIMEOUT_MS / 1000} s` });
      }
    });
  });
}

function stats(r) {
  if (r.failed) return r;
  const keys = [...r.html.matchAll(/\b_hk="?([0-9A-Za-z]+)"?/g)].map(m => m[1]);
  const chars = keys.reduce((n, k) => n + k.length, 0);
  return {
    bytes: Buffer.byteLength(r.html),
    keys: keys.length,
    keyChars: chars,
    meanKeyLength: keys.length ? +(chars / keys.length).toFixed(2) : 0,
    maxKeyLength: Math.max(0, ...keys.map(k => k.length))
  };
}

if (process.argv[2] === "--one") {
  await renderOne(process.argv[3], process.argv[4], process.argv[5]);
} else {
  const result = {};
  for (const entry of ENTRIES)
    for (const url of URLS)
      for (const [name, dir] of Object.entries(PROJECTS))
        ((result[entry] ??= {})[url] ??= {})[name] = stats(await runOne(dir, entry, url));

  const pad = (v, n) => String(v).padStart(n);
  console.log(
    "entry   url        bytes: original → twin (+Δ)       _hk keys   key chars    mean key length   max key length"
  );
  for (const entry of ENTRIES)
    for (const url of URLS) {
      const { original: o, twin: t } = result[entry][url];
      if (o.failed || t.failed) {
        console.log(
          `${entry.padEnd(7)} ${url.padEnd(10)} not measured: ${o.failed ? `original: ${o.failed}` : `twin: ${t.failed}`}`.slice(
            0,
            220
          )
        );
        continue;
      }
      const d = t.bytes - o.bytes;
      console.log(
        `${entry.padEnd(7)} ${url.padEnd(10)} ${pad(o.bytes, 6)} → ${pad(t.bytes, 6)} (+${d}, ${((100 * d) / o.bytes).toFixed(1)}%)`.padEnd(
          51
        ) +
          `${pad(o.keys, 3)} / ${pad(t.keys, 3)}  ${pad(o.keyChars, 4)} → ${pad(t.keyChars, 4)}  ${pad(o.meanKeyLength, 6)} → ${pad(t.meanKeyLength, 6)}   ${pad(o.maxKeyLength, 3)} → ${pad(t.maxKeyLength, 3)}`
      );
    }
  const i = process.argv.indexOf("--json");
  if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(result, null, 2));
}
