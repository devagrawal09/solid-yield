# eslint-plugin-solid-blocks

ESLint rules for [`solid-blocks`](../blocks): the strict rules TypeScript cannot express.

**This is the strict dialect; the compiler route is the ergonomic one.** These rules, the types and the runtime's development errors together hold block code to the model. Each rule is listed in [`documentation/blocks-library.md`](../../documentation/blocks-library.md) §3, next to the type and runtime checks for the same rule.

```js
// eslint.config.mjs (flat config, ESLint 9)
import tsParser from "@typescript-eslint/parser";
import blocks from "eslint-plugin-solid-blocks";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      // type information: no-unyielded-write and no-component-tag use it
      parserOptions: { ecmaFeatures: { jsx: true }, projectService: true }
    },
    plugins: { "solid-blocks": blocks },
    rules: { ...blocks.configs.recommended.rules }
  }
];
```

`recommended` turns every rule on as an error, except two warnings: `no-unshown-wait` (it needs type information) and `require-jsx-factory` (D-093: once per project, a tsconfig without `"jsxFactory": "jsx"` and `"jsxFragmentFactory": "Fragment"`, so TypeScript would not check a fragment's children; it reads the program's options, or without type information the nearest `tsconfig.json` through TypeScript). `require-view-wrapper` (D-089, formerly the warning `prefer-view-wrapper`) is an error with an autofix. Rule ids are `solid-blocks/<rule>`. Several rules have autofixes, for example tag → call for `no-component-tag`. `no-unchecked-foreign-handoff` (D-088) reports a block component handed to plain Solid (the router, `@solidjs/web`'s `render`) without `foreign(…)`; with type information its message names what the component may fail with. The library's own `render` / `hydrate` are not reported: they are the root edge, which may fail (D-033, D-095). The twins' shared config is `examples/harness/eslint.config.mjs`.

Every rule is listed with the type, development-error and transform codes for the same mistake in [`documentation/refusals.md`](../../documentation/refusals.md).

The refusal messages the rules share with the JSX transform are checked against [`vite-plugin-solid-blocks`](../vite-plugin-blocks)'s `rule.json`.

The package ships no type declarations: `test/exports-matrix.test.mjs` pins that TypeScript resolves none.
