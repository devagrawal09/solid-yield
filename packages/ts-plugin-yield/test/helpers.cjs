const ts = require("typescript");
const path = require("node:path");
const { createVirtualService } = require("../src/service.cjs");
const root = path.resolve(__dirname, "fixtures");
/** A language service host over `files` (in fixtures/) and the disk. */
function makeHost(files) {
  const input = new Map(Object.entries(files).map(([f, c]) => [path.join(root, f), c]));
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    types: []
  };
  const host = {
    getCurrentDirectory: () => root,
    getCompilationSettings: () => options,
    getScriptFileNames: () => [...input.keys()],
    getScriptVersion: f => input.get(f) ?? "0",
    getScriptSnapshot: f => {
      const c = input.get(f) ?? ts.sys.readFile(f);
      return c === undefined ? undefined : ts.ScriptSnapshot.fromString(c);
    },
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: f => input.has(f) || ts.sys.fileExists(f),
    readFile: f => input.get(f) ?? ts.sys.readFile(f),
    readDirectory: ts.sys.readDirectory,
    directoryExists: f => f === root || ts.sys.directoryExists(f)
  };
  return Object.assign(host, { input });
}
function makeService(files, config = { mode: "native", include: ["*.tsx", "*.ts"] }) {
  const host = makeHost(files);
  return { service: createVirtualService(ts, host, config), input: host.input, root, ts };
}
module.exports = { makeHost, makeService, root, ts };
