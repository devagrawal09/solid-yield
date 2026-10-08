# TypeScript typing for solid-yield

This workspace package implements TypeScript's standard tsserver plugin API.
It checks the **generated library code** from the same native/sugar transforms
as Vite, then maps diagnostics and hovers to the author's file. It does not add
another color checker or change the library's admission rules.

Requires Node 24+ and TypeScript 6.0 (the tested versions). This package and the
native transform are workspace prototypes, not published standalone packages.
Build the library before checking its generated consumers.

## Install and select files

In this workspace:

```sh
pnpm install
pnpm build
# In another workspace consumer, add the local package:
pnpm add -D ts-plugin-solid-yield@workspace:* typescript
```

Add this to the application's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "ts-plugin-solid-yield",
        "mode": "native",
        "include": ["src/**"]
      }
    ]
  }
}
```

`include` uses glob patterns relative to that tsconfig's directory. Native mode
requires an explicit selection. Vite now accepts the same patterns relative to
its project root:

```js
solidYield({ mode: "native", include: ["src/**"] })
```

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
source buffer. Related diagnostic locations are mapped too. Synthetic spans
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
DocPage: pending false; fails NotFound; may-wait false; requires none
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
