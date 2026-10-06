import { Session } from "node:inspector";
import { appendFileSync } from "node:fs";

/** V8 offsets are UTF-16. Count UTF-8 bytes of disjoint executed ranges. */
export function executedBytes(source, functions) {
  // Vite's module runner appends inline source maps. They are debugger
  // metadata, not JavaScript the application executes.
  const metadata = /^\/\/[#@] sourceMappingURL=/m.exec(source);
  if (metadata) source = source.slice(0, metadata.index);
  const ranges = functions.flatMap(fn => fn.ranges);
  const boundaries = [...new Set(ranges.flatMap(r => [r.startOffset, r.endOffset]))].sort(
    (a, b) => a - b
  );
  let bytes = 0;
  for (let i = 1; i < boundaries.length; i++) {
    const a = boundaries[i - 1],
      b = boundaries[i];
    // A nested zero-count range overrides its executed parent.
    const covering = ranges
      .filter(r => r.startOffset <= a && r.endOffset >= b)
      .sort((x, y) => x.endOffset - x.startOffset - (y.endOffset - y.startOffset));
    if (covering[0]?.count > 0) bytes += Buffer.byteLength(source.slice(a, b));
  }
  return bytes;
}

export function beginCoverage({ file, app, twin, select }) {
  const session = new Session();
  session.connect();
  const call = (method, params = {}) => {
    let out,
      error,
      done = false;
    session.post(method, params, (e, r) => {
      error = e;
      out = r;
      done = true;
    });
    if (!done) throw new Error(`Inspector ${method} did not complete synchronously`);
    if (error) throw error;
    return out;
  };
  const scripts = new Map();
  session.on("Debugger.scriptParsed", ({ params }) => scripts.set(params.scriptId, params.url));
  call("Debugger.enable");
  call("Profiler.enable");
  call("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  const sources = new Map();
  const selected = url => {
    const normalized = url.replaceAll("\\", "/");
    if (select) return select(normalized);
    if (/\/(tests|test|harness|\.executed-bytes-[^/]+)\//.test(normalized)) return false;
    return (
      normalized.includes(
        `/examples/${app === "original" ? "originals/" + twin.replace(/-yield(-h)?$/, "") : twin}/`
      ) ||
      (app !== "original" && /\/packages\/yield\/(src|dist)\//.test(normalized)) ||
      /\/(solid-js|@solidjs\/[^/]+|effect|seroval|seroval-plugins)\/(dist|storage|serialization)\//.test(
        normalized
      )
    );
  };
  let n = 0;
  const checkpoint = phase => {
    const { result } = call("Profiler.takePreciseCoverage");
    const rows = [];
    for (const script of result) {
      const url = script.url || scripts.get(script.scriptId) || "";
      if (!selected(url)) continue;
      if (!sources.has(script.scriptId))
        sources.set(
          script.scriptId,
          call("Debugger.getScriptSource", { scriptId: script.scriptId }).scriptSource
        );
      const source = sources.get(script.scriptId);
      rows.push({
        url,
        bytes: executedBytes(source, script.functions),
        sourceBytes: Buffer.byteLength(source)
      });
    }
    appendFileSync(
      file,
      JSON.stringify({
        app,
        phase,
        index: n++,
        bytes: rows.reduce((s, r) => s + r.bytes, 0),
        scripts: rows
      }) + "\n"
    );
  };
  globalThis.__yieldExecutedBytes = checkpoint;
  return () => {
    delete globalThis.__yieldExecutedBytes;
    call("Profiler.stopPreciseCoverage");
    call("Profiler.disable");
    call("Debugger.disable");
    session.disconnect();
  };
}
