import { analyzeInstances } from "./placement.js";

/** Sugar ends at the existing library IR. Reuse the full cross-module analyzer
 * here: do not infer a second ownership/provenance graph from sugar spelling.
 * This is diagnostic evidence, not a replacement for TypeScript's colors. */
export function sugarFacts(modules, entry) {
  return analyzeInstances(modules, {
    entry,
    resolve(specifier, from) {
      if (!specifier.startsWith(".")) return null;
      const base = new URL(specifier, `file://${from}`).pathname;
      return (
        [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(id =>
          modules.has(id)
        ) ?? null
      );
    }
  });
}
