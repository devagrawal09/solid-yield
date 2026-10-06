# compiler-yield (private prototype)

Place `compilerYield({ onReport })` before `solidYield()` in Vite's plugin list.
The pass returns `null`: it does not change emitted code. It collects source in
memory, resolves imports through Vite, and reports at `buildEnd`. No summary is
written to disk or consumed by another build.

Run `node packages/compiler-yield/src/report.js` for all eight twins. `--json`
prints the detailed report; `--markdown <path>` writes a review document only.
The CLI traverses each twin's entry with Vite's resolver and reads source without
executing application modules. It excludes dependency packages. The plugin
collects the modules visited by the build, so its coverage can differ from the
CLI's source graph. `node --test packages/compiler-yield/test/*.test.mjs` runs
the small definition fixtures.

The CLI and Vite plugin use the audited instance engine: each reached component
call has its own props/setup environment, while recursive rows reuse a widened
family. Local helpers retain their caller's ownership; foreign owners merge
conservatively. Imported data remains U through expressions and helper returns.
`--instances` is an alias for the default; `--joined --json` exposes the older
engine for comparison. The before table is frozen in
`documentation/compiler-c1-before.json`. The generated report classifies every U
origin and lists each eager cause's touched and pulled-in sites.

This is a diagnostic C1 checkpoint, not C2 codegen input. All twin groups have
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
[the finding](../../documentation/compiler-c2-finding.md). C2 codegen is stopped
at this public-API limitation, as C0 §3.1 requires.
