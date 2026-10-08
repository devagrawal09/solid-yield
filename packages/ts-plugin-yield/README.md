# TypeScript typing for solid-yield

This workspace package implements TypeScript's standard tsserver plugin API.
It checks the **generated library code** from the same native/sugar transforms
as Vite. Diagnostics and component hovers use source positions where available;
synthetic spans keep a marked fallback, and unsupported forms can stop lowering. It does not add
another color checker or change the library's admission rules.

Requires Node 24+ and TypeScript 6.0 (the tested versions). This package and the
native transform are experimental and unreleased. Tarball and `file:` installs
are tested outside the workspace.
Build the library before checking its generated consumers.

## Install and select files

Build and pack in the clone (Node 24, pnpm 11):

```sh
pnpm install
pnpm build
for pkg in yield compiler-yield vite-plugin-yield ts-plugin-yield eslint-plugin-yield; do
  pnpm -C packages/$pkg pack --pack-destination /tmp/solid-yield-packs
done
```

In a fresh app, write this `pnpm-workspace.yaml` **before installing**. The
local `0.0.0` packages have real version ranges; these overrides pick your local
copies until they are released to npm. You can replace each tarball path with
`file:/absolute/path/to/solid-yield/packages/<directory>` for a file install.

```yaml
allowBuilds:
  esbuild: true
overrides:
  solid-yield: file:/tmp/solid-yield-packs/solid-yield-0.0.0.tgz
  compiler-yield: file:/tmp/solid-yield-packs/compiler-yield-0.0.0.tgz
  vite-plugin-solid-yield: file:/tmp/solid-yield-packs/vite-plugin-solid-yield-0.0.0.tgz
  ts-plugin-solid-yield: file:/tmp/solid-yield-packs/ts-plugin-solid-yield-0.0.0.tgz
```

```sh
pnpm add /tmp/solid-yield-packs/solid-yield-0.0.0.tgz solid-js@2.0.0-rc.13 @solidjs/web@2.0.0-rc.13
pnpm add -D /tmp/solid-yield-packs/ts-plugin-solid-yield-0.0.0.tgz /tmp/solid-yield-packs/vite-plugin-solid-yield-0.0.0.tgz /tmp/solid-yield-packs/eslint-plugin-solid-yield-0.0.0.tgz typescript@6.0.3 vite@^8 @solidjs/vite-plugin@3.0.0-next.47 eslint@^9 @typescript-eslint/parser@^8
```

`node scripts/fresh-install.mjs` repeats the tarball install in a temporary app,
using the newcomer's app, then runs Vite, ESLint and the CLI. It needs registry
access for ordinary dependencies and installs in the foreground.

Add this to the application's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ESNext", "DOM"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "jsx": "preserve",
    "jsxImportSource": "@solidjs/web",
    "types": ["vite/client"],
    "plugins": [
      {
        "name": "ts-plugin-solid-yield",
        "mode": "native",
        "include": ["src/**"]
      }
    ]
  },
  "include": ["src"]
}
```

`include` uses glob patterns relative to that tsconfig's directory. Native mode
requires an explicit selection. Vite now accepts the same patterns relative to
its project root:

```js
solidYield({ mode: "native", include: ["src/**"] })
```

Apply ESLint to the same source files:

```js
import parser from "@typescript-eslint/parser";
import yieldLint from "eslint-plugin-solid-yield";
export default [{
  files: ["src/**/*.{ts,tsx}"],
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { "solid-yield": yieldLint },
  settings: { "solid-yield": { mode: "native" } },
  rules: yieldLint.configs.recommended.rules
}];
```

The native setting permits plain Solid imports and skips the explicit dialect's
JSX factory requirement. ESLint's `files` selects the native files; keep it in
step with the Vite/TS `include`. Leave this setting off in explicit or directive
sugar config blocks, where `$signal` / `$memo` and the JSX factory still apply.

Keep those roots and selections equal. Vite's existing function predicate is
also supported; a tsconfig cannot serialize a JavaScript predicate, so express
the same selection as patterns there. Dependencies, declaration files and
`.generated` paths are excluded by the shared pattern selector. The standard
Vite script filter still applies.

For directive sugar only, use `{"name":"ts-plugin-solid-yield"}`. Files whose
first directive is `"use yield"` are selected automatically. Unselected files
retain ordinary TypeScript diagnostics. A selected native file takes precedence
if it also contains the directive.

Use the workspace TypeScript version in the editor and restart its TypeScript
server after installing or changing plugin settings. `tsc` does **not** load
language-service plugins; use the CLI in CI.

## CLI

From the repository root (the package also exports this `solid-yield` bin):

```sh
pnpm solid-yield check examples/originals/todos --native 'src/**'
pnpm solid-yield check examples/originals/sierpinski --native 'src/**'
# With selection already in the target tsconfig:
pnpm solid-yield check path/to/app
```

The CLI loads the nearest tsconfig, including its options and aliases, checks
its files, and prints `file:line:column error TS<number>: [CODE] message`.
It exits 1 on errors, including transform refusals and config errors; warnings
alone do not fail. It writes no generated source files. The native gate keeps
its existing two typecheck step names and now calls this CLI. ESLint and runtime
parity remain separate gate steps.

## Mapping and messages

`vite-plugin-solid-yield/virtual` exports the shared lowering functions and
position tables. Every printed AST node records its generated span and authored
span, or a generated marker and the enclosing named routine's name. Tables
compose across reparsing, cloning and reordered nodes, using UTF-16 offsets.
Repeated identifiers are not matched by text. Prop names, JSX component names,
and renderer handoffs preserve their authored origins explicitly.

The private TypeScript service keeps the original filenames for import
resolution and substitutes transformed snapshots. A per-file JSX pragma selects
the library's declarations. It never writes those snapshots into the editor's
source buffer. Root errors follow the surviving operation types back to a read, context read,
or failure site. They appear on that file, with the render/hydrate call as
related information; the CLI prints both locations. Related diagnostic
locations are mapped too. Synthetic spans
without an authored origin report at the enclosing routine's name with
`[generated]`; file-level machinery without a routine reports at the file start.
These tables are for the pre-JSX typing program; Vite's emitted-JavaScript
sourcemap composition is not implemented by this package.

When TypeScript rejects a generator at `component(...)` or `view(...)`, the
adapter examines the rejected generator's library operation types to locate the
bad read, write or creation. The type error must already exist: this step only
explains and locates it. It does not independently decide host admission.

[The message catalog](src/catalog.cjs) reuses `READ_IN_SETUP`,
`WRITE_IN_REACTIVE`, `CREATE_OUTSIDE_SETUP`, `PENDING_ROOT`, `NO_PROVIDER`,
`SETTLED_PROP`, `FOREIGN_HANDOFF` and `NATIVE_CALLBACK_FAILURE` where those
library/lint/runtime meanings overlap. Transform codes are retained. Original
TypeScript numeric codes remain available. Unsupported internal error shapes
use `GENERATED_TYPE`, never pretend to have a specific fix. Ordinary TypeScript
errors retain their normal messages.

Component hovers read `HoleCall`/`ComponentView` types. Named routine and source
hovers make a temporary type-only query using the library's `PendingOf`,
`FailsOf`, `WaitsOf`, and `RequiresOf` aliases in the original lexical scope.
Failure wrapper IDs display their class names and contexts display their names.
For example:

```text
DocPage — does not suspend; can fail with NotFound; does not wait; needs no context
```

## Verified scope

```sh
pnpm -C packages/ts-plugin-yield test
node scripts/sugar-typing-evidence.mjs
```

Tests spawn a real tsserver, load the plugin through a tsconfig, open native
source, assert semantic diagnostic positions and quickinfo text, and apply an
unsaved edit. Other tests cover directive sugar, imported component colors,
source-map fallbacks, CLI exit codes and ten recoverable review slots.
[The evidence and remaining findings](../../documentation/sugar-typing.md)
distinguish those checks from editor UI verification.

Only diagnostics and quickinfo are virtualized. Completion, navigation, rename,
refactoring and code actions still use the editor's original source service;
they do not promise generated contracts or mapped fixes. The plugin has not been
visually tested in an editor. Hover on unresolved, anonymous or unsupported
higher-order call forms can retain TypeScript's ordinary inferred signature.
A transform refusal blocks that selected transform group until fixed; no
recovery tree is invented. Whole-project lowering after edits is synchronous
and has not been benchmarked on large applications.
