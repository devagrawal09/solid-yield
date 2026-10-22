# Prototype contract

Each prototype lives in `prototypes/<name>/` and exports from
`prototypes/<name>/index.mjs`:

```ts
export const name: "typed" | "dataflow";
export function createChecker(options: {
  rootDir: string;                 // absolute; file paths below are absolute too
  files: readonly string[];        // the project's checked .ts/.tsx files (whole program, every call)
  compilerOptions?: import("typescript").CompilerOptions; // the harness passes a fixed rc.17 config
  readFile?: (path: string) => string | undefined; // optional override (the harness uses it for in-memory edits)
}): Checker;

interface Checker {
  /** Full check. Cold on first call; later calls reuse whatever the prototype caches. */
  check(): CheckResult;
  /** Replace a file's text (an HMR edit) and re-check what depends on it. Returns only the diagnostics now current for the whole program. */
  update(path: string, text: string): CheckResult;
  dispose(): void;
}

interface CheckResult {
  diagnostics: SoundDiagnostic[];
  /** Wall time of this check in ms, measured inside the prototype (the harness also measures outside). */
  elapsedMs: number;
  /** Optional facts for the emit-readiness criterion: per component, what the prototype knows. */
  facts?: ComponentFacts[];
}

// Mirrors @solidjs/signals DiagnosticEvent (dev.d.ts), minus runtime-only fields.
interface SoundDiagnostic {
  code: string;                    // from src/codes.mjs — nothing else
  kind: "strict-read" | "async" | "write" | "lifecycle" | "owner" | "error" | "analysis";
  severity: "info" | "warn" | "error";
  message: string;                 // plain language, names the construct and the fix; NO generated-code identifiers
  ownerName?: string;              // the component ("<EquipmentRow>") or computation ("memo", "effect", handler attribute)
  ownerPath?: string[];            // root-first, e.g. ["<App>", "<Inventory>", "<EquipmentRow>"] when known
  loc: { file: string; line: number; col: number; endLine?: number; endCol?: number }; // 1-based, in the ORIGINAL source
  related?: { message: string; loc: SoundDiagnostic["loc"] }[];  // e.g. the render root, the caller that makes a prop reactive
  data?: Record<string, unknown>;  // e.g. { failures: ["Error", "unknown"], pending: true, construct: "useContext" }
}

interface ComponentFacts {
  component: string; file: string;
  pending: boolean | "unknown"; failures: string[];
  reads: { loc: Loc; scope: "setup" | "tracking" | "handler" | "effect"; source: string }[];
  boundaries: { kind: "Loading" | "Errored"; loc: Loc }[];
  unanalyzed: { loc: Loc; construct: string }[];
}
```

Rules:
- D-129: reused runtime codes keep runtime severity. Prop-expression obligations
  use the child’s consuming read as `loc`, the caller’s expression in `related`;
  apply child read boundaries, then caller element boundaries, outward to roots.
  Required warning misses are soundness failures too. See CONTEXT.md.
- Emission is pass-through: a prototype never rewrites the user's code on disk; it
  may build virtual code in memory (prototype A) or tables (prototype B).
- The prototype must not import from packages/yield, packages/compiler-yield,
  packages/vite-plugin-yield or packages/ts-plugin-yield. Copy what you borrow
  (failure inference ideas, position mapping) into your prototype directory and
  say so in NOTES.md.
- Types come from the package's own `node_modules` (solid-js / @solidjs/web
  2.0.0-rc.17). `compilerOptions` from the harness: strict, jsx preserve,
  jsxImportSource @solidjs/web, moduleResolution bundler, noEmit, skipLibCheck.
- A prototype that cannot analyze a construct emits `UNANALYZED_BOUNDARY` (warn)
  there and treats the construct's values as worst case. It never emits nothing.
- A diagnostic's `loc` is in the user's file. A prototype that maps from
  generated code must map every diagnostic back; one that cannot be mapped is
  reported at the component's name with `data.unmapped = true` (the harness
  counts these against precision).
- No `any` in prototype sources (JS with JSDoc types or TS; `// @ts-check` on).
  No suppressions.

Vite surface: `harness/vite.mjs` exports `soundVitePlugin(prototype, options)`
which wraps any conforming checker: `buildStart` runs `check()` (cold), and in
serve mode sends errors to the overlay while serving; in build mode fails the
build on errors; `handleHotUpdate` runs `update(file, text)` and re-sends. The
shared `harness/vite-measure.mjs <prototype>` builds the Equipment fixture with
that plugin (strict and report-only) and prints cold-build and single-file HMR
re-check times for `EquipmentRow.tsx`.
