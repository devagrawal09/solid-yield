# vite-plugin-solid-yield

The JSX transform's one rule for [`solid-yield`](https://github.com/devagrawal09/solid-yield/tree/main/packages/yield) (D-003): inside a JSX expression or attribute value, `yield* e` becomes `perform(e)`, imported from `solid-yield`. Each read is then its own hole, and the view generator runs once. Nothing else is lowered. Published as `vite-plugin-solid-yield` (D-011; `@solidjs/vite-plugin-yield` in the Solid fork).

**The default is the explicit dialect** (D-002): this plugin also has experimental sugar/native modes. By default it is the strict dialect's transform, and Solid's `experiment/iterable-signals` branch bakes the model into its compiler and core. Its four refusal codes are listed with the matching lint rule and development errors in [`documentation/refusals.md`](https://github.com/devagrawal09/solid-yield/blob/main/documentation/refusals.md).

Codes such as D-074 here and in the messages cite the design's decision log, [`DECISIONS.md`](https://github.com/devagrawal09/solid-yield/blob/main/documentation/DECISIONS.md) (each rule, its alternatives and its reasoning).

## Use

```js
// vite.config.mjs
import solidYield from "vite-plugin-solid-yield";
import solid from "@solidjs/vite-plugin";

export default { plugins: [solidYield(), solid()] };
```

For selected plain Solid 2 source:

```js
export default {
  plugins: [solidYield({ mode: "native", include: ["src/**"] }), solid()]
};
```

Use the same selection in the TS plugin, and the native ESLint setting on those
files. [Complete installation and native tsconfig](../ts-plugin-yield/README.md).
Tarball and file installs are tested without workspace links. Native lowering
has no composed runtime source map yet; unsupported forms can be refused.

`solidYield()` runs `enforce: "pre"`, before the JSX compiler. It skips a module whose source has no `yield` (and no `lazy` from the yield module) without parsing it (every spelling of a generator, `function *f`, `*method()`, `async *gen`, is a candidate; the parse decides), and returns `null` (no change) for a module with no hole. Its source map is chained by Vite with the compiler's, so a runtime error maps back to the authored line and column. Options: `yieldModule`, `lazy`, and `filter(file)` (by default `.js`/`.jsx`/`.ts`/`.tsx` and their `m`/`c` forms, outside `node_modules`).

## `lazy()` module URLs (D-047)

`solid-yield` exports its own `lazy`, with Solid's signature `lazy(fn, options?, moduleUrl?)`. `@solidjs/vite-plugin` annotates `lazy(() => import("…"))` only when `lazy` comes from `solid-js`. So this plugin writes the same annotation for a `lazy` imported from the yield module: `lazy(() => import("./Page"), void 0, "__SOLID_LAZY_MODULE__:./Page")`. `solid()` then resolves the placeholder to the project-relative module path, and the lazy component carries its `moduleUrl` for asset preloading and the hydration manifest. Eligibility mirrors the compiler's pass:

- the callee is spelled `lazy` and is a named import of `lazy` from the yield module;
- the first argument returns `import("literal")`;
- the call has one or two arguments.

Option `lazy: false` turns the pass off.

## Exports

- `solidYield` (also the default export): the Vite plugin.
- `babelPluginYield`: the rule and the lazy pass as a Babel plugin, run before the JSX transform. Options: `yieldModule`, `lazy`.
- `transform(code, { filename, yieldModule, lazy })`: the rule and the lazy pass applied to source text. It returns `{ code, map }`, or `null` when the module has no `yield*` in JSX and no eligible `lazy` call.
- `lazyCalls`, `applyLazyModuleUrl`, `LAZY_PLACEHOLDER_PREFIX`: the lazy pass's parts.
- `yieldRule(program)`: the rule as one function. It classifies every `yield` of a Babel program that sits in JSX into holes and refusals. `applyYieldRule` applies it to the AST.
- `REFUSALS`, `YieldRuleError`, `DEFAULT_YIELD_MODULE`.

## The rule

| Position                                                                                                        | Result                                                                |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `{yield* e}` as a child, `a={yield* e}` as an attribute, of a DOM element or a foreign Solid component (D-067)  | `perform(e)`                                                          |
| a yield-component call in a hole, `{yield* Card({ todo })}` (D-062)                                             | one hole: `perform(Card({ todo }))`; the argument is left as written  |
| a `yield*` inside a nested function in JSX                                                                      | that function's own; not a hole of this JSX                           |
| an event prop (`onClick`, `on:click`, `oncapture:…`): `onClick={yield* save}` binds an `$event` handler (D-072) | `perform(save)`, which returns the handler; the types check it is one |
| `ref`                                                                                                           | refused: `YIELD_IN_REF`                                        |
| a spread attribute                                                                                              | refused: `YIELD_IN_SPREAD`                                     |
| a spread child                                                                                                  | refused: `YIELD_IN_SPREAD_CHILD`                               |
| a plain `yield` in JSX                                                                                          | refused: `PLAIN_YIELD_IN_JSX`                                  |

A refusal throws a `YieldRuleError` whose message lists each refusal as `[CODE] message (line:column)`, the compiler's format. The rule does not know hosts. A hole performed while a setup runs is the runtime's `[JSX_IN_SETUP]` (D-041).

`transform()` edits only the rewritten spans. TypeScript, formatting and comments stay as written, and the source map is exact.

## The `perform` import's line

`import { perform as _$perform } from "solid-yield";` goes just before the module's first statement, on that statement's line. It comes after any hashbang, directive prologue and leading comments, which stay where they are. No line moves, so a compiler error in a file with holes names the authored line, and the source map covers the columns.

While the fork's Rust rule was the parity oracle, the import took a line of its own, as the rule inserted it. That kept the compiled output byte-identical to the rule's, at the cost of compiler error messages one line late. D-043 removed the rule and the placement changed (D-031 note).

## Fixture parity

`test/fixtures/` holds the oracle:

- `rule.json`: the rule's 16 cases (11 accepted, 5 refused), its 4 refusal codes, and the compiler's message for each refusal;
- `twins/`: one source file per JSX twin;
- `compiled/`: the JSX compiler's output, in `dom` and `ssr` (hydratable) modes, for each accepted case and each twin file.

They were generated once from the fork's Rust compiler while it carried the rule (D-043), and the plugin's output, compiled, reproduced every one byte for byte. When D-043 removed the rule, the compiled outputs were regenerated with the new import placement. 16 of the 26 are unchanged; in the other 10 the import line comes after the leading comments instead of before them. `test/fixtures/generate.mjs` records this. The tests compile the plugin's output with Solid's compiler and compare byte for byte, with nothing normalized. Refusals must match the Rust rule's message, position included.

## Status

In-repo package, `0.0.0`, unreleased. Its runtime dependencies are `compiler-yield`, `@babel/core`, `magic-string`, and `typescript` (the experimental sugar front end). Its peers are `solid-yield` (the module the rewritten code imports `perform` from) and, optionally, `vite`.

The tests also use, as devDependencies:

- `@solidjs/compiler`, to compile the plugin's output for the parity checks;
- `@solidjs/vite-plugin` and `vite`, for the source-map and `lazy` tests;
- the twins' sources, for the `h`-twin no-op check and the rendering twin's lazy pages. Those tests skip when `examples/` is absent.

There is no build step: `src/` is plain ESM with JSDoc types, checked by `tsc --checkJs`, and `src/index.d.ts` is written by hand.

## Lazy pages on the server

The annotated `moduleUrl` is the key the server render looks up in the **client asset manifest**. Pass that manifest to `renderToString` or `renderToStream`; without it an annotated lazy page throws on the server and a contained SSR error can leave blank content. The client and server must use the same module keys and app tree. Solid serializes the matching client entries and preloads them before hydration. Missing entries report `[LAZY_HYDRATION_PRELOAD]` in development.

Use a separate server JSX config, `solid({ ssr: true, hydratable: true })`, and import `generateHydrationScript` from the server build of `@solidjs/web`. The client build returns an empty string. The [SSR and hydration recipe](https://github.com/devagrawal09/solid-yield/blob/main/documentation/getting-started.md#ssr-and-hydration) includes both configs, the manifest, an awaited stream and the non-test-mode Vitest setup. [Lazy/ChunkError retry](https://github.com/devagrawal09/solid-yield/blob/main/documentation/getting-started.md#lazy-pages-and-chunk-retry) uses an `Errored` catching the import failure.


## Experimental sugar directive

On `proto/sugar`, a file beginning with `"use yield";` opts into a project-aware
front end. Top-level PascalCase functions returning JSX become yield components;
plain source calls, path reads, events and known callbacks reconstruct the
library's generator code before the existing JSX rule runs. Unmarked files keep
the explicit behavior above. The Vite plugin requires a tsconfig for sugar.

This is a prototype: it reparses project snapshots and has no composed runtime
source map. The [TS plugin and CLI](../ts-plugin-yield/README.md) check generated
code and map diagnostics to source; genuinely synthetic locations retain a
marked fallback. The plain
`transform()` and Babel plugin remain the explicit one-rule API; sugar is wired
into the Vite adapter. See [the design and findings](../../documentation/sugar-design.md)
for unsupported forms and the unresolved typing choice.
