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

This is a partial C1 implementation, not a C2 codegen input. It joins a component's
props across calls (context-sensitivity cap 1), has no separate instances of a
recursive component, and cannot recover all ownership across foreign components.
It reports unresolved spans. Capture checks conservatively reject setup-local
values rather than executing Solid's serializer. Unknown calls stay U.

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
