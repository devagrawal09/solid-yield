# TypeScript typing for solid-yield

This workspace package implements TypeScript's standard tsserver plugin API.
It checks the **generated library code** from the same native transform
as Vite. Tests cover mapped native diagnostics and component hovers;
some synthetic spans still use a marked fallback, and unsupported forms can stop lowering. It does not add
another color checker or change the library's admission rules.

Requires Node 24+ and TypeScript 6.0 (the tested versions). This package and the
native transform are experimental and unreleased. The tarball path below is tested outside the workspace.
Build the library before checking its generated consumers.

## Install and select files

Build and pack in the clone (Node 24, pnpm 11):

```sh
pnpm install
pnpm build
mkdir -p /tmp/solid-yield-packs
for pkg in yield compiler-yield vite-plugin-yield ts-plugin-yield eslint-plugin-yield; do
  pnpm -C packages/$pkg pack --pack-destination /tmp/solid-yield-packs
done
```

Rebuild and re-pack all five packages after changing the checkout, even when
these tarballs already exist. Their `0.0.0` filenames do not identify a commit.
For separate checkouts, choose a fresh directory containing the commit ID and
replace every pack, install and override path below with that directory.

In a fresh app, write this `pnpm-workspace.yaml` **before installing**. The
local `0.0.0` packages have real version ranges; these overrides pick your local
copies until they are released to npm.

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
solidYield({ mode: "native", include: ["src/**"] });
```

Apply ESLint to the same source files:

```js
import parser from "@typescript-eslint/parser";
import yieldLint from "eslint-plugin-solid-yield";
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "solid-yield": yieldLint },
    settings: { "solid-yield": { mode: "native" } },
    rules: yieldLint.configs.recommended.rules
  }
];
```

The native setting permits plain Solid imports and skips the explicit dialect's
JSX factory requirement. These rules mainly cover explicit/generated code; they did not catch the second reviewer's twelve native cases. The TS plugin or CLI reports failure and structural diagnostics for the tested native forms. Unsupported constructs can produce a refusal, and imports through them can retain incomplete summaries. ESLint's `files` selects the native files; keep it in
step with the Vite/TS `include`. Leave this setting off in explicit config
blocks, where `$signal` / `$memo` and the JSX factory still apply.

Keep those roots and selections equal. Vite's existing function predicate is
also supported; a tsconfig cannot serialize a JavaScript predicate, so express
the same selection as patterns there. Dependencies, declaration files and
`.generated` paths are excluded by the shared pattern selector. The standard
Vite script filter still applies.

Unselected files retain ordinary TypeScript diagnostics. The legacy
`"use yield"` directive dialect has been removed; the plugin only lowers files
selected with `mode: "native"` and `include`. Explicit generator code uses the
library's ordinary TypeScript declarations.

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

## Consumer workflow

From an installed application with native selection in its tsconfig:

```sh
pnpm exec solid-yield check .
pnpm exec tsc --noEmit
pnpm exec eslint src
pnpm run build
pnpm test
```

Keep both type checks: `tsc` checks the authored Solid program and does not load
this plugin; the native checker also checks its selected, lowered model. Neither
build success nor a clean ESLint run establishes the model's failure, pending or
provider obligations. Runtime tests remain necessary for application behavior.

### Local form state

Keep draft and busy state in the form that owns them. The shared service handles
request failures and returns a result; the event keeps the draft on failure,
so pressing Save again retries. A render error boundary is not a substitute for
handling an event's rejected request. This example is checked from this README
by `test/native-onboarding.test.cjs`.

<!-- native-draft-example -->

```tsx
import { createContext, createSignal, useContext } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";

interface Drafts {
  message: Accessor<string>;
  save: (title: string) => Promise<boolean>;
}
const DraftsContext = createContext<Drafts>();

function createDrafts() {
  const [message, setMessage] = createSignal("");
  return {
    message,
    save: async (title: string) => {
      try {
        const response = await fetch("/api/drafts", { method: "POST", body: title });
        if (!response.ok) throw new Error("Save failed");
        setMessage("Saved");
        return true;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
        return false;
      }
    }
  };
}

function DraftForm() {
  const drafts = useContext(DraftsContext)!;
  const [title, setTitle] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const draft = title();
    setBusy(true);
    try {
      if (await drafts.save(draft)) setTitle("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <input value={title()} onInput={event => setTitle(event.currentTarget.value)} />
      <button type="submit" disabled={busy()}>
        Save
      </button>
      <p role="status">{drafts.message()}</p>
    </form>
  );
}

function App() {
  return (
    <DraftsContext value={createDrafts()}>
      <DraftForm />
    </DraftsContext>
  );
}
render(() => <App />, document.body);
```

### Refusal glossary

The `SUGAR_*` names are retained diagnostic codes, not a request to add a
directive or rewrite the application with generators. A refusal means that
the construct was not modeled, not that the checker proved it safe or proved
the original Solid code incorrect.

| Code                      | Meaning and next step                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUGAR_ESCAPE`            | A routine reaches a consumer whose invocation/ownership is not known. Check the callback's consumer and retain the smallest failing call site; do not erase its type or silence the failure.                                                                                                                                                                 |
| `SUGAR_HOST`              | A reactive operation occurs in an unsupported function or method shape. The diagnostic should identify the unsupported host; use a supported ownership boundary, not a new global store merely to bypass the refusal.                                                                                                                                        |
| `SUGAR_CALLBACK`          | The callback's reactive execution context could not be established. Synchronous helpers and event handlers are different from arbitrary escaping callbacks; make the invocation explicit or reduce the case for a report.                                                                                                                                    |
| `EVENT_REJECTS`           | An event can let a modeled failure escape. Handle it in the event/helper, or preserve an existing supported failure contract; a render error boundary does not handle arbitrary event rejections.                                                                                                                                                            |
| `NATIVE_SETUP_FAILURE`    | Setup work has a failure obligation. An unresolved call contract can also retain `unknown`; that is not proof of an authored `throw`. Check the implicated call and its available implementation.                                                                                                                                                            |
| `DEPENDENT_TYPE`          | A component's types could not be inferred, so its render obligations are not fully checked. Fix the component's root errors and rerun; this is not a conclusion that a provider is missing or a particular failure escapes.                                                                                                                                  |
| `NATIVE_DETACHED_PROMISE` | An async reactive helper runs where it is called, so its promise cannot be dropped (the statements after it would wait for the helper) or kept as a value (a local awaited later, an argument, a `.then` receiver). Await or return it where it is made, or move the detached work into a plain async function, whose promise is kept or dropped as written. |
| `MODULE_STATE`            | Reactive state was created without a lifecycle owner. Create it in a component or a deliberately owned root with an appropriate disposal lifecycle.                                                                                                                                                                                                          |
| `CATCH_SWALLOWS`          | A catch discards failures without a modeled handling action. Return a fallback, handle the failure, or rethrow failures that the catch does not handle. Logging alone is not handling.                                                                                                                                                                       |

A `void` return type is not a promise that a foreign function cannot throw.
When an implementation or its effects are unavailable, the checker can retain
an `unknown` failure. Do not fix that by casting it to a failure-free function
or adding `any`. For an ordinary local implementation that is nevertheless
refused, preserve a reproduction rather than relocating component-local state
to change the checker's result.

### Handling failures

Handle errors as part of the application's behavior. For example, a parser can
return a fallback result that the caller displays:

```ts
function parseDraft(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    return { message: error instanceof Error ? error.message : String(error) };
  }
}
```

If discarding a failure is genuinely intentional, put the annotation **inside
that catch**, with a concrete reason. This is an explicit absorption policy,
not a general remedy for an unknown contract:

```ts
try {
  await sendBestEffortTelemetry();
} catch (error) {
  /* @yield-absorb: telemetry failure must not prevent the user action */
  console.error(error);
}
```

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
`HELD_PROP`, `REACTIVE_PROP`, `FOREIGN_HANDOFF` and `NATIVE_CALLBACK_FAILURE` where those
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
unsaved edit. Other tests cover imported component colors,
source-map fallbacks, CLI exit codes and all three saved newcomer review sets,
including valid controls and additional probes.
[The evidence and remaining findings](../../documentation/sugar-typing.md)
distinguish those checks from editor UI verification.

Only diagnostics and quickinfo are virtualized. Completion, navigation, rename,
refactoring and code actions still use the editor's original source service;
they do not promise generated contracts or mapped fixes. The plugin has not been
visually tested in an editor. Hover on unresolved, anonymous or unsupported
higher-order call forms can retain TypeScript's ordinary inferred signature.
A refused file keeps its original TypeScript view. Other selected files are
retried and keep their checked hovers; summaries through a refused import can
still be incomplete. Whole-project lowering after edits is synchronous
and has not been benchmarked on large applications.
