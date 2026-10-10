// Builds one repro as plain Solid 2 and through vite-plugin-solid-yield (prod + dev),
// serves each build, and runs the repro's probe.mjs in Chromium.
// Usage (from a repro dir, with node_modules symlinked to the opencode-web copy):
//   node ../runtime-harness.mjs
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const dir = process.cwd();
const req = createRequire(path.join(dir, "node_modules", "_"));
const { build } = await import(req.resolve("vite"));
const pick = (m) => (typeof m.default === "function" ? m.default : typeof m.default?.default === "function" ? m.default.default : m);
const solid = pick(await import(req.resolve("@solidjs/vite-plugin")));
const solidYield = pick(await import(req.resolve("vite-plugin-solid-yield")));
const { chromium } = req("playwright");
const probe = (await import(path.join(dir, "probe.mjs"))).default;
const variants = [
  ["plain", false, "production"],
  ["plain-dev", false, "development"],
  ["yield", true, "production"],
  ["yield-dev", true, "development"],
];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [name, useYield, mode] of variants) {
  const outDir = path.join(dir, "dist-" + name);
  process.env.NODE_ENV = mode;
  try {
    await build({
      root: dir, mode, logLevel: "error", configFile: false,
      build: { outDir, emptyOutDir: true, minify: false },
      plugins: [...(useYield ? [solidYield({ mode: "native", include: ["src/**"] })] : []), solid()],
    });
  } catch (e) {
    console.log(`${name}: BUILD FAILED ${String(e.message).split("\n")[0].slice(0, 200)}`);
    continue;
  }
  const server = http.createServer((q, s) => {
    const f = path.join(outDir, q.url === "/" ? "index.html" : q.url);
    if (!fs.existsSync(f)) return s.writeHead(404).end();
    s.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : "text/html" });
    fs.createReadStream(f).pipe(s);
  }).listen(0);
  const port = server.address().port;
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0].slice(0, 160)));
  await page.goto(`http://127.0.0.1:${port}/`);
  let result;
  try { result = await probe(page); } catch (e) { result = "probe threw: " + String(e).split("\n")[0].slice(0, 120); }
  console.log(`${name}: ${JSON.stringify(result)}${errors.length ? "  pageerror: " + errors[0] : ""}`);
  await page.close();
  server.close();
  fs.rmSync(outDir, { recursive: true, force: true });
}
await browser.close();
