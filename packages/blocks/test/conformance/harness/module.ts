/**
 * Compile a scenario source the way an app's build does and evaluate the
 * emitted module with explicitly injected dependencies.
 *
 * The harness never hand-writes "what the compiler would emit": every mode
 * runs real transform output.
 *
 * - The library route (`library` sources): `vite-plugin-solid-blocks`'
 *   `transform()` (the JSX transform's one block rule: `yield*` in a JSX
 *   hole becomes `perform(…)`, D-003), then the published
 *   `@solidjs/compiler`'s `transform()` — the two steps `blocks()` and
 *   `solid()` take in an app's Vite config.
 * - The reference route (`reference` sources): `@solidjs/compiler` alone.
 *
 * TypeScript's `transpileModule` then strips types (the compiler keeps them,
 * as Vite's esbuild step would strip them). Evaluation rewrites only the
 * module syntax the compilers emit (single-line `import { … } from "…"` and
 * `export function|const|let|class`) into bindings over an injected module
 * table, so the same compiled code runs against whichever `solid-js` /
 * `@solidjs/web` / `solid-blocks` build the current vitest config resolves
 * (client, server, or hydrating client). Anything outside that grammar fails
 * loudly rather than being approximated.
 */
import { createRequire } from "node:module";
// The plugin by path, as the package's own vite configs import it (the
// reverse workspace edge would make a cycle: the plugin devDepends on this package).
import { transform as blocksTransform } from "../../../../vite-plugin-blocks/src/index.js";
import type { SourceKind } from "./types.js";

const require = createRequire(import.meta.url);
const compiler = require("@solidjs/compiler") as {
  transform(code: string, options: Record<string, unknown>): { code: string };
};
const ts = require("typescript") as typeof import("typescript");

export type CompileOptions = Record<string, unknown>;

export interface CompiledModule {
  code: string;
  /** Static facts about the emitted code, reported in the coverage matrix. */
  stats: LoweringStats;
}

export interface LoweringStats {
  /** `function*` bodies left in the output (the library interprets every one). */
  generators: number;
  /** `_$perform(` holes the block rule wrote (an event bound in a view, `onClick={yield* save}`, is one too: D-072). */
  performs: number;
}

export function lowering(code: string): LoweringStats {
  const count = (re: RegExp) => code.match(re)?.length ?? 0;
  return {
    generators: count(/function\s*\*/g),
    performs: count(/_\$perform\(/g)
  };
}

export function compile(source: string, kind: SourceKind, options: CompileOptions): CompiledModule {
  const filename = kind === "library" ? "scenario.tsx" : "scenario.jsx";
  let code = source;
  if (kind === "library") {
    const ruled = blocksTransform(code, { filename, lazy: false });
    if (ruled) code = ruled.code;
  }
  code = compiler.transform(code, { filename, ...options }).code;
  const { outputText } = ts.transpileModule(code, {
    fileName: filename.replace(/x$/, ""),
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false
    }
  });
  return { code: outputText, stats: lowering(outputText) };
}

const IMPORT = /^import\s+(.+?)\s+from\s+"([^"]+)";?\s*$/;
const EXPORT_DECL = /^export\s+(?:async\s+)?(function\*?|const|let|class)\s+([\w$]+)/;
/** `export let a, b, c;` — declarations without initializers. */
const EXPORT_LIST = /^export\s+(?:let|var)\s+([\w$]+(?:\s*,\s*[\w$]+)*)\s*;\s*$/;

function bindings(clause: string, spec: string): string {
  clause = clause.trim();
  const named = clause.match(/^\{([^}]*)\}$/);
  if (named) {
    const parts = named[1]
      .split(",")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [imported, local] = part.split(/\s+as\s+/);
        return local ? `${imported}: ${local}` : imported;
      });
    return `const { ${parts.join(", ")} } = __import(${JSON.stringify(spec)});`;
  }
  const ns = clause.match(/^\*\s+as\s+([\w$]+)$/);
  if (ns) return `const ${ns[1]} = __import(${JSON.stringify(spec)});`;
  throw new Error(`[conformance] unsupported import clause \`${clause}\` from "${spec}"`);
}

/** Evaluate compiled ESM against `modules`. Returns the module's exports (live bindings). */
export function evaluate(code: string, modules: Record<string, unknown>): Record<string, any> {
  const exported: string[] = [];
  // `export { a, b };` (an export list, possibly multi-line).
  code = code.replace(/^export\s*\{([^}]*)\};?\s*$/gm, (_, names: string) => {
    for (const part of names.split(",")) {
      const name = part.trim();
      if (!name) continue;
      if (/\sas\s/.test(name))
        throw new Error(`[conformance] unsupported export alias \`${name}\``);
      exported.push(name);
    }
    return "";
  });
  const lines = code.split("\n").map(line => {
    const imp = line.match(IMPORT);
    if (imp) return bindings(imp[1], imp[2]);
    const list = line.match(EXPORT_LIST);
    if (list) {
      exported.push(...list[1].split(",").map(name => name.trim()));
      return line.replace(/^export\s+/, "");
    }
    const exp = line.match(EXPORT_DECL);
    if (exp) {
      exported.push(exp[2]);
      return line.replace(/^export\s+/, "");
    }
    if (/^\s*(import|export)\b/.test(line)) {
      throw new Error(`[conformance] unsupported module syntax in compiled output: ${line}`);
    }
    return line;
  });
  // Live bindings: `export let` values assigned during setup stay visible.
  const live = exported.map(name => `get ${name}() { return ${name}; }`).join(", ");
  const body =
    `"use strict";\n${lines.join("\n")}\n` +
    `return { ${live} };\n//# sourceURL=conformance-scenario.js`;
  const importer = (spec: string) => {
    if (!(spec in modules))
      throw new Error(`[conformance] scenario imported unknown module "${spec}"`);
    return modules[spec];
  };
  return new Function("__import", body)(importer);
}
