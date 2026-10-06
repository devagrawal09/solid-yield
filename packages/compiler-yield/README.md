# compiler-yield (private prototype)

Place `compilerYield({ onReport })` before `solidYield()` in Vite's plugin list.
The pass returns `null`: it does not change emitted code. It collects source in
memory, resolves imports through Vite, and reports at `buildEnd`. No summary is
written to disk or consumed by another build.

Run `node packages/compiler-yield/src/report.js` for all nine twins. `--json`
prints the detailed report; `--markdown <path>` writes a review document only.
The CLI traverses each twin's entry with Vite's resolver and reads source without
executing application modules. It excludes dependency packages. The plugin
collects the modules visited by the build, so its coverage can differ from the
CLI's source graph. `node --test packages/compiler-yield/test/*.test.mjs` runs
the small definition fixtures.

The CLI and Vite plugin use the audited instance engine: each reached component
call has its own props/setup environment, while recursive rows reuse a widened
family. Local helpers retain their caller's ownership; foreign ancestry constrains lifetime without merging independent children. Imported data remains U through expressions and helper returns.
`--instances` is an alias for the default; `--joined --json` exposes the older
engine for comparison. The before table is frozen in
`documentation/compiler-c1-before.json`. The generated report classifies every U
origin and lists each eager cause's touched and pulled-in sites.

This is a diagnostic C1 checkpoint, not C2 codegen input. Twin groups have
abstract spans, but physical DOM claims and serializer round trips are unproved.
JSX/h counts are separate and count call-site instances, not runtime DOM nodes.
The remaining callable-alternative blind spot and the definition clarifications
are documented in `documentation/compiler-findings.md`.

`SPAN_OVERLAP` records an unnumbered C0 case: independent state can have the same
smallest DOM span. `CAPTURE_FALLBACK` records conservative merging at a rejected
capture. Neither is counted as one of M1–M6. Effects and unproved work in setup
make a candidate eager. The report names effect dependencies and the other parts
that join their root. The `[EAGER]` type marker is not implemented.

The report cannot yet establish how many independently hydratable roots an app
has. In particular, an unresolved span is not permission to emit a root.

The public namespace spike is separate from analysis. Run
`node --test packages/compiler-yield/test/hydration-namespace.test.mjs`.
Immediate roots retain their server nodes. The delayed schedule pins F-C5:
the second root is silently replaced on Solid rc.13. See
[the finding](../../documentation/compiler-c2-finding.md). Dev's 2026-10-07 ruling allows eager-only tier 1, so F-C5 no longer blocks it.


## Experimental eager docs emission

`src/eager.js` is a separate opt-in Vite pass. Place it before `solidYield()` and
Solid, with `{directory: docsDirectory, onPlan}`. The docs example's
`compiled/vite.config.mjs` does this. Seven physical roots cover C1's eleven
groups through explicit route/error-boundary fallbacks. All hydrate
synchronously; each uses the library runtime, its own key namespace and a
public-serializer input record. Navigation/footer code is server-only.

Scope is the docs shell's direct component calls with empty browser inputs.
Unsupported captures fall back to the whole library entry with a variable
location. A one-root plan leaves code unchanged. The plan reports expansions;
it must not be read as a general purpose splitter.

The `/` page passes 24 hydrated steps and `/docs/start` passes direct smoke.
**C2 remains incomplete:** direct `/docs/missing` loses its typed failure during
SSR and fails hydration on original, library and compiled routes (F-C9).
Implementation stopped on the failure-preservation requirement. The expected
failure is pinned separately; green tests do not turn it into passing smoke.
See [the C2 record](../../documentation/compiler-c2-finding.md) for captures,
source maps, conformance coverage, findings and reproduction commands.

## C1b interaction reachability

`src/reachability.js` adds directed read/write/call facts in a separate analysis
subclass. It does not change the existing C1 placement result or C2 emission.
`node packages/compiler-yield/src/reachability-report.js --write` regenerates
[the report](../../documentation/compiler-reachability.md) and its range/edge
records for all nine twins. Omit `--write` for a report-only run; `--only docs-yield`
limits the inventory. The gate runs the full report without byte thresholds.

`test/reachability.test.mjs` covers pending reads, event calls through context,
computed retry actions, optimistic/error writes, effects, returned fallback
handlers, runtime reset binds, flow recreation and UTF-8 range accounting.
The byte mapper uses the transform package's existing source-map dependency.
The empty-root and SSR-data probes are in `examples/harness/executed-bytes/`.

The tier-3 number is an optimistic first-use code budget, not measured execution.
The report also gives a per-phase reset estimate, prices first materialization,
and separates authored event medians from scripted interaction medians. Runtime
work above an empty root, opaque package calls and descriptor/transport costs
remain unpriced. No resumer or runtime behavior is added here.
