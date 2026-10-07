import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../../packages/vite-plugin-yield/package.json", import.meta.url)
);
const { TraceMap, decodedMappings } = require("@jridgewell/trace-mapping");

// Partition the actual minified output, not Rollup's pre-minification lengths.
// Each span inherits its source-map segment; punctuation belongs to that span.
// Unmapped glue, source-map comments and newlines remain explicitly unassigned.
export function chunkAttribution(code, map) {
  const trace = new TraceMap(map);
  const mappings = decodedMappings(trace);
  const bytes = {};
  const add = (key, text) => (bytes[key] = (bytes[key] ?? 0) + Buffer.byteLength(text));
  code.split("\n").forEach((line, index, lines) => {
    const segments = mappings[index] ?? [];
    if (!segments.length || segments[0][0] > 0)
      add("unmapped", line.slice(0, segments[0]?.[0] ?? line.length));
    segments.forEach((segment, i) => {
      const source = segment.length < 4 ? "unmapped" : trace.sources[segment[1]];
      const key = /\/(marked|highlight\.js)\/(lib|es)\//.test(source)
        ? "article payload libraries"
        : /\/src\/article-pipeline(?:__compiler_dep)?\.ts$/.test(source)
          ? "article pipeline adapter"
          : /\/articles\/[^/]+\.md/.test(source)
            ? "embedded Markdown data"
            : /__compiler_(client|slots)\.tsx$/.test(source)
              ? "bootstrap and inert registration"
              : /\/src\/content\.tsx$/.test(source)
                ? "content"
                : /\/src\/widgets\.tsx$/.test(source)
                  ? "widgets"
                  : /\/src\/app\.tsx$/.test(source)
                    ? "app and router assembly"
                    : /\/src\/(api|errors)\.ts$/.test(source)
                      ? "app data and errors"
                      : source === "unmapped"
                        ? source
                        : "runtime";
      add(key, line.slice(segment[0], segments[i + 1]?.[0] ?? line.length));
    });
    if (index < lines.length - 1) add("unmapped", "\n");
  });
  if (Object.values(bytes).reduce((a, b) => a + b, 0) !== Buffer.byteLength(code))
    throw new Error("Source-map attribution does not partition chunk bytes");
  return bytes;
}

export function compiledDecomposition(runs, shipped) {
  const run = runs[0];
  const single = run.find(r => r.app === "compiled-single");
  const seven = run.find(r => r.app === "compiled");
  const library = run.find(r => r.app === "library");
  if (!single || !seven || !library) return undefined;
  const categories = result => {
    const totals = {};
    for (const { url, bytes } of result.loadScripts) {
      const group = /serialization|\/seroval/.test(url)
        ? "codec"
        : /\/examples\//.test(url)
          ? /__compiler_(client|slots)|\/stream\//.test(url)
            ? "bootstrap and inert registration"
            : "app modules"
          : /\/packages\/yield\//.test(url)
            ? "yield runtime"
            : /vite-plugin\//.test(url)
              ? "Vite plugin (legacy counter scope)"
              : "Solid and router";
      totals[group] = (totals[group] ?? 0) + bytes;
    }
    return totals;
  };
  const output = {
    meaning:
      "Seven minus single is the net root-strategy cost, including module duplication/packing and the changed root assembly; single minus library is the residual. It is not a count of repeated hydrate calls.",
    load: { library: categories(library), single: categories(single), seven: categories(seven) },
    rootStrategy: { load: seven.phases[0].bytes - single.phases[0].bytes },
    residual: { load: single.phases[0].bytes - library.phases[0].bytes }
  };
  const sum = r => r.phases.slice(1).reduce((n, p) => n + p.bytes, 0);
  output.rootStrategy.steps = sum(seven) - sum(single);
  output.residual.steps = sum(single) - sum(library);
  if (shipped.length) {
    const s = shipped.find(r => r.app === single.app),
      p = shipped.find(r => r.app === seven.app),
      l = shipped.find(r => r.app === library.app);
    for (const metric of ["js", "gzip"]) {
      output.rootStrategy[metric] = p[metric] - s[metric];
      output.residual[metric] = s[metric] - l[metric];
    }
    const aggregate = result => {
      const totals = {};
      for (const chunk of result.chunkDetails)
        for (const [key, bytes] of Object.entries(chunk.attribution))
          totals[key] = (totals[key] ?? 0) + bytes;
      return totals;
    };
    output.shippedAttribution = { single: aggregate(s), seven: aggregate(p) };
  }
  return output;
}
