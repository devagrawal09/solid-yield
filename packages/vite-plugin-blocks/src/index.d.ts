import type { Plugin } from "vite";
import type { NodePath, PluginObj, types } from "@babel/core";
import type { SourceMap } from "magic-string";

/** The positions the rule refuses, by code. */
export declare const REFUSALS: {
  readonly BLOCKS_YIELD_IN_EVENT: string;
  readonly BLOCKS_YIELD_IN_REF: string;
  readonly BLOCKS_YIELD_IN_SPREAD: string;
  readonly BLOCKS_YIELD_IN_SPREAD_CHILD: string;
  readonly BLOCKS_PLAIN_YIELD_IN_JSX: string;
};
export type RefusalCode = keyof typeof REFUSALS;

/** `"@solidjs/blocks"`: where `perform` is imported from unless configured. */
export declare const DEFAULT_BLOCKS_MODULE: string;

export interface Refusal {
  code: RefusalCode;
  /** `[CODE] message (line:column)`, the compiler's format. */
  message: string;
  path: NodePath<types.YieldExpression>;
}

/** Thrown for refused positions: every refusal, one per line of the message. */
export declare class BlocksRuleError extends Error {
  code: RefusalCode;
  refusals: { code: RefusalCode; line: number; column: number }[];
  /** Set by `transform()`, for Vite. */
  id?: string;
  loc?: { file: string; line: number; column: number };
}

/** The rule as one function: the holes it rewrites and the positions it refuses. */
export declare function blocksRule(program: NodePath<types.Program>): {
  holes: NodePath<types.YieldExpression>[];
  refusals: Refusal[];
};

/** Apply the rule to a Babel program in place; throws `BlocksRuleError`. */
export declare function applyBlocksRule(
  program: NodePath<types.Program>,
  t: typeof types,
  blocksModule?: string
): boolean;

export interface BabelPluginBlocksOptions {
  blocksModule?: string;
  /** The `lazy()` module-URL pass (default `true`; needs a file name). */
  lazy?: boolean;
}

/** The rule as a Babel plugin; run it before the JSX transform. */
export declare function babelPluginBlocks(
  api: typeof import("@babel/core"),
  options?: BabelPluginBlocksOptions
): PluginObj;

export interface TransformOptions {
  /** The module's file name: picks the parser dialect and names the map's source. */
  filename: string;
  /** Where `perform` and `lazy` come from (default `"@solidjs/blocks"`). */
  blocksModule?: string;
  /** The `lazy()` module-URL pass (default `true`). */
  lazy?: boolean;
  /** Produce a source map (default `true`). */
  sourceMap?: boolean;
}

export interface TransformResult {
  code: string;
  map: SourceMap | null;
}

/** The rule applied to source text; `null` when nothing changed. */
export declare function transform(code: string, options: TransformOptions): TransformResult | null;

/** Babel parser plugins for a file name. */
export declare function parserPlugins(filename: string): string[];

export interface BlocksPluginOptions {
  /** Where `perform` and `lazy` come from (default `"@solidjs/blocks"`). */
  blocksModule?: string;
  /** Annotate `lazy(() => import("…"))` from the blocks module with its module URL (default `true`, D-047). */
  lazy?: boolean;
  /** Which files to look at (default: `.js`/`.jsx`/`.ts`/`.tsx` and their `m`/`c` forms, outside `node_modules`). */
  filter?: (file: string) => boolean;
}

/** The Vite plugin (`enforce: "pre"`): put it before `solid()`. */
export declare function blocks(options?: BlocksPluginOptions): Plugin;
export default blocks;

/** `"__SOLID_LAZY_MODULE__:"`: `@solidjs/vite-plugin`'s frozen placeholder prefix. */
export declare const LAZY_PLACEHOLDER_PREFIX: string;

/** Every eligible `lazy(() => import("…"))` call from the blocks module. */
export declare function lazyCalls(
  program: NodePath<types.Program>,
  blocksModule: string
): { path: NodePath<types.CallExpression>; specifier: string; padOptions: boolean }[];

/** The `lazy()` module-URL pass applied to a Babel program in place. */
export declare function applyLazyModuleUrl(
  program: NodePath<types.Program>,
  t: typeof types,
  blocksModule: string
): boolean;
