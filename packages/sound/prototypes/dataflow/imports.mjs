// @ts-check
// Unchecked workspace implementation files are opaque, not more analysis roots.
// Declarations and explicitly listed installed source links supply type information.
import ts from "typescript";

/** @param {readonly string[]} files @param {string} rootDir
 * @param {ts.CompilerOptions} options @param {ts.ModuleResolutionHost} host */
export function boundedImports(files, rootDir, options, host) {
  const roots = new Set(files);
  const cache = ts.createModuleResolutionCache(rootDir, f => f, options);
  /** @type {Map<string, Set<string>>} */
  const opaque = new Map();
  /** @param {string[]} names @param {string} containing */
  const resolve = (names, containing) => names.map(name => {
    const resolved = ts.resolveModuleName(name, containing, options, host, cache).resolvedModule;
    if (resolved && !roots.has(resolved.resolvedFileName) && !resolved.resolvedFileName.includes("/node_modules/") && !resolved.resolvedFileName.endsWith(".d.ts") && !resolved.resolvedFileName.endsWith(".d.mts") && !resolved.resolvedFileName.endsWith(".d.cts")) {
      let names = opaque.get(containing);
      if (!names) opaque.set(containing, names = new Set());
      names.add(name);
      return undefined;
    }
    opaque.get(containing)?.delete(name);
    return resolved;
  });
  return { resolve, opaque };
}
