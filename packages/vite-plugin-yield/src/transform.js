import { trackParsed } from "./positions.js";
// @ts-check
/**
 * `transform(code, { filename, yieldModule })`: the rule, and the `lazy()`
 * module-URL pass (D-047), applied to source text. The source is parsed with
 * Babel (TypeScript and JSX kept as written) and only the rewritten spans are
 * edited, so the output is the input plus the edits — types, formatting and
 * comments untouched — and the source map is exact. `null` when nothing
 * changed: a file with no `yield*` in JSX and no eligible `lazy` call comes
 * back byte-identical because it does not come back at all.
 */
import babel from "@babel/core";
import MagicString from "magic-string";
import { YieldRuleError, DEFAULT_YIELD_MODULE, yieldRule, performLocal } from "./rule.js";
import { LAZY_PLACEHOLDER_PREFIX, lazyCalls } from "./lazy.js";

/** @typedef {import("@babel/core").types.Program} Program */
/** @typedef {import("@babel/core").NodePath<Program>} ProgramPath */

/**
 * Babel parser plugins for a file name: TypeScript for `.ts`/`.tsx` (and their
 * `m`/`c` forms), JSX for everything but `.ts`, decorators everywhere (the
 * plugins `@solidjs/vite-plugin` parses with).
 * @param {string} filename
 * @returns {import("@babel/core").ParserOptions["plugins"]}
 */
export function parserPlugins(filename) {
  const ext = /\.([mc]?[jt]sx?)$/i.exec(filename)?.[1].toLowerCase().replace(/^[mc]/, "") ?? "js";
  /** @type {import("@babel/core").ParserOptions["plugins"]} */
  const plugins = ["decorators"];
  if (ext !== "ts") plugins.push("jsx");
  if (ext === "ts" || ext === "tsx") plugins.push("typescript");
  return plugins;
}

/**
 * @typedef {object} TransformOptions
 * @property {string} filename the module's file name (picks the parser dialect; names the map's source)
 * @property {string} [yieldModule] the module `perform` and `lazy` come from (default `solid-yield`)
 * @property {boolean} [lazy] the `lazy()` module-URL pass (default `true`)
 * @property {boolean} [sourceMap] produce a source map (default `true`)
 */

/**
 * @typedef {object} TransformResult
 * @property {string} code
 * @property {import("magic-string").SourceMap | null} map
 */

/**
 * Whether the text could need the transform at all: a `yield` (the rule, as
 * the compiler's cheap pre-check) or a `lazy` from the yield module (the
 * lazy pass).
 * @param {string} code
 * @param {string} yieldModule
 * @param {boolean} lazy
 */
export function mayTransform(code, yieldModule, lazy) {
  return code.includes("yield") || (lazy && code.includes("lazy") && code.includes(yieldModule));
}

/**
 * Parse a module and hand back its program path.
 * @param {string} code
 * @param {string} filename
 * @returns {ProgramPath | null}
 */
export function parseProgram(code, filename) {
  const ast = babel.parseSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    sourceType: "module",
    parserOpts: { plugins: parserPlugins(filename) }
  });
  if (!ast) return null;
  trackParsed(ast, code, filename, { plugins: parserPlugins(filename) });
  /** @type {ProgramPath | null} */
  let program = null;
  babel.traverse(ast, {
    Program(path) {
      program = path;
      path.stop();
    }
  });
  return program;
}

/**
 * Apply the rule to source text. Throws a `YieldRuleError` (every refusal,
 * the compiler's format; `id` and `loc` set for Vite) on a refused position.
 * @param {string} code
 * @param {TransformOptions} options
 * @returns {TransformResult | null}
 */
export function transform(code, options) {
  const { filename } = options;
  if (!filename) throw new TypeError("transform: `filename` is required");
  const yieldModule = options.yieldModule ?? DEFAULT_YIELD_MODULE;
  const lazy = options.lazy ?? true;
  if (!mayTransform(code, yieldModule, lazy)) return null;

  const program = parseProgram(code, filename);
  if (!program) return null;

  const { holes, refusals } = yieldRule(program);
  if (refusals.length) {
    const error = new YieldRuleError(refusals);
    const first = error.refusals[0];
    Object.assign(error, {
      id: filename,
      loc: { file: filename, line: first.line, column: first.column }
    });
    throw error;
  }
  const calls = lazy ? lazyCalls(program, yieldModule) : [];
  if (!holes.length && !calls.length) return null;

  const s = new MagicString(code);
  if (holes.length) applyHoles(s, code, program, holes, yieldModule);
  for (const { path, specifier, padOptions } of calls) {
    // `lazy(fn)` → `lazy(fn, void 0, "__SOLID_LAZY_MODULE__:<specifier>")`,
    // `lazy(fn, options)` → `lazy(fn, options, "…")`
    const args = path.node.arguments;
    const end = /** @type {number} */ (args[args.length - 1].end);
    const placeholder = JSON.stringify(LAZY_PLACEHOLDER_PREFIX + specifier);
    s.appendLeft(end, (padOptions ? ", void 0" : "") + ", " + placeholder);
  }

  return {
    code: s.toString(),
    map:
      options.sourceMap === false
        ? null
        : s.generateMap({ source: filename, file: filename, includeContent: true, hires: true })
  };
}

/**
 * The rule's edits: each hole's `yield*` becomes `_$perform(`…`)` and the
 * import is inserted.
 * @param {MagicString} s
 * @param {string} code
 * @param {ProgramPath} program
 * @param {import("@babel/core").NodePath<import("@babel/core").types.YieldExpression>[]} holes
 * @param {string} yieldModule
 */
function applyHoles(s, code, program, holes, yieldModule) {
  const local = performLocal(program);
  for (const { node } of holes) {
    const start = /** @type {number} */ (node.start);
    const end = /** @type {number} */ (node.end);
    // `yield*` and the whitespace after it become `_$perform(`; the
    // argument stays exactly as written (parentheses included), so a
    // sequence argument stays one argument.
    const keyword = /^yield\s*\*\s*/.exec(code.slice(start, end));
    if (!keyword) throw new Error(`unexpected yield text at ${start}`);
    s.overwrite(start, start + keyword[0].length, `${local}(`);
    s.appendLeft(end, ")");
  }
  // The first statement of the module: on the line of the module's first
  // statement, just before it — after any hashbang, directive prologue and
  // leading comments, which stay where they are. No line moves, so a compiler
  // error further down still names the authored line (D-031 note; the
  // compiler's rule, removed by D-043, gave the import a line of its own). A
  // module with a hole has a statement: the hole is in one.
  const line = `import { perform as ${local} } from ${JSON.stringify(yieldModule)};`;
  const first = /** @type {number} */ (program.node.body[0].start);
  s.prependLeft(first, line + " ");
}
