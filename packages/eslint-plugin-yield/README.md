# eslint-plugin-solid-yield

ESLint rules for [`solid-yield`](https://github.com/devagrawal09/solid-yield/tree/main/packages/yield): the strict rules TypeScript cannot express.

**This is the strict dialect; the compiler route is the ergonomic one.** These rules, the types and the runtime's development errors together hold routine code to the model. Each rule is listed in [`documentation/yield-library.md`](https://github.com/devagrawal09/solid-yield/blob/main/documentation/yield-library.md) §3, next to the type and runtime checks for the same rule.

Codes such as D-074 here and in the messages cite the design's decision log, [`DECISIONS.md`](https://github.com/devagrawal09/solid-yield/blob/main/documentation/DECISIONS.md) (each rule, its alternatives and its reasoning).

```sh
pnpm add -D eslint@^10 @typescript-eslint/parser@^8 typescript@~6.0 eslint-plugin-solid-yield
```

`eslint` (`>=9`) and `@typescript-eslint/parser` (`^8`, for type information) are peer dependencies. `@typescript-eslint/parser` 8 supports TypeScript `>=4.8.4 <6.1.0`, hence `typescript@~6.0`.

```js
// eslint.config.mjs (flat config, ESLint 9 or later)
import tsParser from "@typescript-eslint/parser";
import solidYield from "eslint-plugin-solid-yield";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      // type information: no-unyielded-write and no-component-tag use it
      parserOptions: { ecmaFeatures: { jsx: true }, projectService: true }
    },
    plugins: { "solid-yield": solidYield },
    rules: { ...solidYield.configs.recommended.rules }
  }
];
```

`recommended` turns every rule on as an error, except two warnings: `no-unshown-wait` (it needs type information) and `require-jsx-factory` (D-093: once per project, a tsconfig without `"jsxFactory": "jsx"` and `"jsxFragmentFactory": "Fragment"`, so TypeScript would not check a fragment's children; it reads the program's options, or without type information the nearest `tsconfig.json` through TypeScript). `require-view-wrapper` (D-089, formerly the warning `prefer-view-wrapper`) is an error with an autofix. Rule ids are `solid-yield/<rule>`. Several rules have autofixes, for example tag → call for `no-component-tag`. `no-unchecked-foreign-handoff` (D-088) reports a yield component handed to plain Solid (the router, `@solidjs/web`'s `render`) without `foreign(…)`; with type information its message names what the component may fail with. The library's own `render` / `hydrate` are not reported: they are the root edge, which may fail (D-033, D-095). The twins' shared config is `examples/harness/eslint.config.mjs`.

`no-read-in-setup` reports a source read in a component or row setup. It recognizes local signals, stores, memos, props and row paths without type information; with types it also checks source aliases. Context reads and state creation are allowed. Move a read to a view hole, `$memo`, `$effect` or `$event`.

Every rule is listed with the type, development-error and transform codes for the same mistake in [`documentation/refusals.md`](https://github.com/devagrawal09/solid-yield/blob/main/documentation/refusals.md).

The refusal messages the rules share with the JSX transform are checked against [`vite-plugin-solid-yield`](https://github.com/devagrawal09/solid-yield/tree/main/packages/vite-plugin-yield)'s `rule.json`.

The package ships no type declarations: `test/exports-matrix.test.mjs` pins that TypeScript resolves none.
