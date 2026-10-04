# vite-plugin-solid-blocks

The JSX transform's one rule for [`solid-blocks`](../blocks) (D-003): inside a JSX expression or attribute value, `yield* e` becomes `perform(e)`, imported from `solid-blocks`. Each read is then its own hole, and the view generator runs once. Nothing else is lowered. Published as `vite-plugin-solid-blocks` (D-011; `@solidjs/vite-plugin-blocks` in the Solid fork).

**This is the strict dialect; the compiler route is the ergonomic one** (D-002): this plugin is the strict dialect's transform, and Solid's `experiment/iterable-signals` branch bakes the model into its compiler and core.

## Use

```js
// vite.config.mjs
import blocks from "vite-plugin-solid-blocks";
import solid from "@solidjs/vite-plugin";

export default { plugins: [blocks(), solid()] };
```

`blocks()` runs `enforce: "pre"`, before the JSX compiler. It skips a module whose source has no `function*` (and no `lazy` from the blocks module) without parsing it, and returns `null` (no change) for a module with no hole. Its source map is chained by Vite with the compiler's, so a runtime error maps back to the authored line and column. Options: `blocksModule`, `lazy`, and `filter(file)` (by default `.js`/`.jsx`/`.ts`/`.tsx` and their `m`/`c` forms, outside `node_modules`).

## `lazy()` module URLs (D-047)

`solid-blocks` exports its own `lazy`, with Solid's signature `lazy(fn, options?, moduleUrl?)`. `@solidjs/vite-plugin` annotates `lazy(() => import("…"))` only when `lazy` comes from `solid-js`. So this plugin writes the same annotation for a `lazy` imported from the blocks module: `lazy(() => import("./Page"), void 0, "__SOLID_LAZY_MODULE__:./Page")`. `solid()` then resolves the placeholder to the project-relative module path, and the lazy component carries its `moduleUrl` for asset preloading and the hydration manifest. Eligibility mirrors the compiler's pass:

- the callee is spelled `lazy` and is a named import of `lazy` from the blocks module;
- the first argument returns `import("literal")`;
- the call has one or two arguments.

Option `lazy: false` turns the pass off.

## Exports

- `blocks` (also the default export): the Vite plugin.
- `babelPluginBlocks`: the rule and the lazy pass as a Babel plugin, run before the JSX transform. Options: `blocksModule`, `lazy`.
- `transform(code, { filename, blocksModule, lazy })`: the rule and the lazy pass applied to source text. It returns `{ code, map }`, or `null` when the module has no `yield*` in JSX and no eligible `lazy` call.
- `lazyCalls`, `applyLazyModuleUrl`, `LAZY_PLACEHOLDER_PREFIX`: the lazy pass's parts.
- `blocksRule(program)`: the rule as one function. It classifies every `yield` of a Babel program that sits in JSX into holes and refusals. `applyBlocksRule` applies it to the AST.
- `REFUSALS`, `BlocksRuleError`, `DEFAULT_BLOCKS_MODULE`.

## The rule

| Position                                                                                                       | Result                                                               |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `{yield* e}` as a child, `a={yield* e}` as an attribute, of a DOM element or a foreign Solid component (D-067) | `perform(e)`                                                         |
| a block-component call in a hole, `{yield* Card({ todo })}` (D-062)                                            | one hole: `perform(Card({ todo }))`; the argument is left as written |
| a `yield*` inside a nested function in JSX                                                                     | that function's own; not a hole of this JSX                          |
| an event prop (`onClick`, `on:click`, `oncapture:…`)                                                           | refused: `BLOCKS_YIELD_IN_EVENT`                                     |
| `ref`                                                                                                          | refused: `BLOCKS_YIELD_IN_REF`                                       |
| a spread attribute                                                                                             | refused: `BLOCKS_YIELD_IN_SPREAD`                                    |
| a spread child                                                                                                 | refused: `BLOCKS_YIELD_IN_SPREAD_CHILD`                              |
| a plain `yield` in JSX                                                                                         | refused: `BLOCKS_PLAIN_YIELD_IN_JSX`                                 |

A refusal throws a `BlocksRuleError` whose message lists each refusal as `[CODE] message (line:column)`, the compiler's format. The rule does not know hosts. A hole performed while a setup runs is the runtime's `[JSX_IN_SETUP]` (D-041).

`transform()` edits only the rewritten spans. TypeScript, formatting and comments stay as written, and the source map is exact.

## The `perform` import's line

`import { perform as _$perform } from "solid-blocks";` goes just before the module's first statement, on that statement's line. It comes after any hashbang, directive prologue and leading comments, which stay where they are. No line moves, so a compiler error in a file with holes names the authored line, and the source map covers the columns.

While the fork's Rust rule was the parity oracle, the import took a line of its own, as the rule inserted it. That kept the compiled output byte-identical to the rule's, at the cost of compiler error messages one line late. D-043 removed the rule and the placement changed (D-031 note).

## Fixture parity

`test/fixtures/` holds the oracle:

- `rule.json`: the rule's 15 cases (7 accepted, 8 refused), its 5 refusal codes, and the compiler's message for each refusal;
- `twins/`: one source file per JSX twin;
- `compiled/`: the JSX compiler's output, in `dom` and `ssr` (hydratable) modes, for each accepted case and each twin file.

They were generated once from the fork's Rust compiler while it carried the rule (D-043), and the plugin's output, compiled, reproduced every one byte for byte. When D-043 removed the rule, the compiled outputs were regenerated with the new import placement. 16 of the 26 are unchanged; in the other 10 the import line comes after the leading comments instead of before them. `test/fixtures/generate.mjs` records this. The tests compile the plugin's output with Solid's compiler and compare byte for byte, with nothing normalized. Refusals must match the Rust rule's message, position included.

## Status

In-repo package, `0.0.0`, unreleased. Its runtime dependencies are `@babel/core` and `magic-string`. Its peers are `solid-blocks` (the module the rewritten code imports `perform` from) and, optionally, `vite`.

The tests also use, as devDependencies:

- `@solidjs/compiler`, to compile the plugin's output for the parity checks;
- `@solidjs/vite-plugin` and `vite`, for the source-map and `lazy` tests;
- the twins' sources, for the `h`-twin no-op check and the rendering twin's lazy pages. Those tests skip when `examples/` is absent.

There is no build step: `src/` is plain ESM with JSDoc types, checked by `tsc --checkJs`, and `src/index.d.ts` is written by hand.
