import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import solidYield from "../../vite-plugin-yield/src/index.js";
// Use the transform package's declared source-map dependency; no new install.
const mapRequire = createRequire(new URL("../../vite-plugin-yield/package.json", import.meta.url));
const { TraceMap, decodedMappings } = mapRequire("@jridgewell/trace-mapping");
const require = createRequire(new URL("../../vite-plugin-yield/package.json", import.meta.url));
export function unionRanges(ranges) {
  const result = [];
  for (const r of ranges
    .filter(r => r.end > r.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = result.at(-1);
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else result.push({ start: r.start, end: r.end });
  }
  return result;
}
export function differenceRanges(ranges, seen) {
  let result = unionRanges(ranges);
  for (const old of unionRanges(seen))
    result = result.flatMap(r =>
      old.end <= r.start || old.start >= r.end
        ? [r]
        : [
            { start: r.start, end: Math.min(r.end, old.start) },
            { start: Math.max(r.start, old.end), end: r.end }
          ].filter(x => x.end > x.start)
    );
  return result;
}
const offsets = code => {
  const out = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === "\n") out.push(i + 1);
  return out;
};
// Project every mapped generated segment whose authored start belongs to a body.
// Keep generated offsets (UTF-16) and count their UTF-8 spans, like coverage.mjs.
export function projectRanges(original, transformed, map, ranges) {
  const originalLines = offsets(original),
    generatedLines = offsets(transformed);
  const segments = decodedMappings(new TraceMap(map)),
    result = [];
  for (let line = 0; line < segments.length; line++) {
    const row = segments[line];
    for (let i = 0; i < row.length; i++) {
      const s = row[i];
      if (s.length < 4) continue;
      const at = originalLines[s[2]] + s[3];
      if (!ranges.some(r => r.start <= at && at < r.end)) continue;
      const start = generatedLines[line] + s[0];
      const end =
        i + 1 < row.length
          ? generatedLines[line] + row[i + 1][0]
          : (generatedLines[line + 1] ?? transformed.length);
      result.push({ start, end });
    }
  }
  return unionRanges(result);
}
export const bytesOf = (code, ranges) =>
  unionRanges(ranges).reduce((n, r) => n + Buffer.byteLength(code.slice(r.start, r.end)), 0);
export async function transformBodies(modules) {
  modules = [...modules];
  const twinRoot = modules[0].match(/^(.*\/examples\/[^/]+)\//)?.[1];
  const { createServer, createRunnableDevEnvironment } = await import(
    pathToFileURL(require.resolve("vite"))
  );
  const mod = await import(pathToFileURL(require.resolve("@solidjs/vite-plugin")));
  const solid = typeof mod.default === "function" ? mod.default : mod.default.default;
  const server = await createServer({
    root: resolve(import.meta.dirname, ".."),
    configFile: false,
    mode: "production",
    appType: "custom",
    logLevel: "silent",
    resolve: { alias: twinRoot ? { "~": resolve(twinRoot, "src") } : {} },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [solidYield(), solid({ hot: false, ssr: true })],
    server: { middlewareMode: true, hmr: false, ws: false },
    environments: {
      bytes: {
        consumer: "client",
        resolve: { conditions: ["browser", "production"] },
        optimizeDeps: { noDiscovery: true, include: [] },
        dev: {
          moduleRunnerTransform: true,
          createEnvironment: (name, config) =>
            createRunnableDevEnvironment(name, config, { runnerOptions: { hmr: false } })
        }
      }
    }
  });
  const out = new Map();
  try {
    for (const file of modules) {
      const transformed = await server.environments.bytes.transformRequest("/@fs" + file);
      if (!transformed?.map) throw new Error(`No transform map: ${file}`);
      out.set(file, { original: readFileSync(file, "utf8"), ...transformed });
    }
  } finally {
    await server.close();
  }
  return out;
}
export function countBodies(authored, transformed, seen = new Map()) {
  let bytes = 0,
    fresh = 0;
  const ranges = [];
  for (const file of new Set(authored.map(r => r.file))) {
    const t = transformed.get(file);
    if (!t) throw new Error(`Untransformed body: ${file}`);
    const projected = projectRanges(
      t.original,
      t.code,
      t.map,
      authored.filter(r => r.file === file)
    );
    const old = seen.get(file) ?? [];
    bytes += bytesOf(t.code, projected);
    fresh += bytesOf(t.code, differenceRanges(projected, old));
    seen.set(file, unionRanges([...old, ...projected]));
    ranges.push({ file, ranges: projected, bytes: bytesOf(t.code, projected) });
  }
  return { bytes, fresh, ranges };
}
