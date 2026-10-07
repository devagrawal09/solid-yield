# solid-yield analyzer (private tool)

Run `pnpm run analyze docs-yield` from the repository root, or
`node packages/compiler-yield/src/report.js docs-yield`. Omit the example name
for all nine twins. Add `--json` for the full report.

The tool reads each example's entry graph with Vite's resolver. It does not
execute application modules, change source, emit chunks or write a report file.
The optional Vite analysis plugin also returns no transformed code.

- **C1 groups and eager causes:** parts joined by state, calls, contexts,
  boundaries and captures; effects and setup work, with the sites they touch
  and pull into a group. Groups are not proof of separate physical roots.
- **C1b reach:** each event's transitive reads, writes, calls, effects, boundaries
  and recreated children. Bound events are marked. This is possible graph
  reach, not measured execution, scripted-phase reach or byte savings.
- **S/R/client provenance:** server-derived and server-recomputable regions,
  their external input vectors, and refused captures. U producers and event
  writes stay client. A typed scalar is only statically eligible; the public
  codec still must check its settled value before emission.

The passes and their fixtures were ported from `proto/compiler` at `778a0d5`.
The emitters, transport integration, byte-budget reports and branch-specific
marked/highlight.js purity contract remain on that branch. Main has the earlier
article fixture, so live counts can differ from its C3b report. Opaque calls
remain unknown; there is no general package-purity claim (F-C12).

The gate runs `analyzer:test` and `analyzer:report`. The latter reports all nine
twins and checks that the tool runs; it has no thresholds for its results.
The capture helper's public-codec tests are separate from static eligibility.

The measured R break-even was about **76 KB raw / 25.6 KB gzip** of removable
server-derived code; it includes the fixed frame/RPC and shell/slot integration
cost, and successful markup responses cost about 0.94 KB gzip more per
navigation than equivalent Markdown JSON. See the branch's
[measurement](https://github.com/devagrawal09/solid-yield/blob/778a0d59fab7d6711c96aa911febe11456ba9a21/documentation/compiler-c3b-payload.md).
