# Compiler frame adapter

The bounded docs R emit is validated against **solid-js 2.0.0-rc.13 and
@solidjs/web 2.0.0-rc.13 only**. Its router control uses next.29. The tested
range is the single rc.13 release, not all Solid 2 release candidates.

All private runtime access lives in
[`solid-adapter.js`](../packages/compiler-yield/src/solid-adapter.js).
`hosted-region-client.js` uses public frame, owner, and transport functions;
`hosted-region-server.js` passes the public document encoder into the adapter.
The adapter's load-time check runs in both server and browser output. The
Vite plugin reads the installed manifests resolved from both the app and the
adapter, then supplies those versions through a virtual module. It does not
trust the dependency range in package.json or send filesystem code to browsers.
A changed or missing version fails with:

> compiler-yield's frame adapter was validated against 2.0.0-rc.13; found solid-js X / @solidjs/web Y (application) — see documentation/compiler-adapter.md

This is a deliberate stop for a Solid bump. Do not widen the check until the
contract tests, route checks, exact DOM comparison, and bytes below have been
rerun. A passing version check is not proof of a general server-component API.
Completed document SSR, one keyed Like slot with primitive inputs, and ordinary
RPC responses are covered. Incremental document attachment, nested server JSX
in slot inputs, and async slot inputs remain outside this emitter's proof.

## Inventory

The before locations refer to starting commit `9b97cf2`. `client` and `server`
mean `packages/compiler-yield/src/hosted-region-client.js` and
`hosted-region-server.js`. After locations refer to `solid-adapter.js` unless
another file is named.

| Internal import or behavior                                                                                                                               | Before file:line     | Public replacement exists?                                                                                   | Result / after file:line                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `solid-js/internal` → `sharedConfig`                                                                                                                      | client:10            | No public slot-claim context setter                                                                          | Isolated, adapter:3                                                     |
| Read `sharedConfig.hydrating`                                                                                                                             | client:19            | Yes: `isHydrating()` from `solid-js`                                                                         | Replaced, adapter:36                                                    |
| Enumerate `globalThis._$HY.r` to obtain slot arguments                                                                                                    | client:60–68         | Yes: `takeHydrationValue(key)` from `@solidjs/web`                                                           | Replaced, adapter:59; missing/pending/rejected inputs fail explicitly   |
| Discover `_hk` elements; move their keys out of the outer registry; temporarily replace `sharedConfig.registry` and `claimRoots`; restore even on a throw | client:23–36         | No public way to claim just an existing slot range within an active document hydration                       | Isolated, adapter:35–54                                                 |
| Recreate slot owner prefix `sc-${id}-${occurrence}-`                                                                                                      | client:33            | `createOwner({id})` is public; the server slot prefix is not                                                 | Isolated, adapter:50                                                    |
| Slot record name `sc:slot:${id}:like#route-like`, keyed occurrence spelling, document version 0                                                           | client:60–68,84      | Reader and `host.apply` are public; no public document-slot descriptor supplies the key/version/scope        | Isolated, adapter:20,57–65                                              |
| Document registry `_$SC.impl(id, props, binding)`, `r(id)`, initial address map `a`, late registration callback `reg`                                     | client:45–47,118–122 | Public `installServerComponents()` installs its own wrapper binding; no custom existing-element binding hook | Isolated, adapter:67–80                                                 |
| Discover authored SSR hosts by `data-fid`, then remove it after adoption/rebind; frame routing must continue without it                                   | client:43–44,105,110 | Public `createFrame(element)` exists; no public document host lookup without a marker                        | Isolated, adapter:22–33; application/rebind/disposal tested             |
| Document encoder returns `[open {t}, owned children, close {t}]` with fixed `<solid-frame data-fid="…" style="display:contents">`; swap outer tags only   | server:11–28         | Encoder is public; no authored-root option or separate public document-slot encoder                          | Isolated, adapter:83–105; stricter full opening-tag shape check         |
| `Object.assign` preserves enumerable encoder symbols for component ID, source, and address                                                                | server:12,30         | Public encoder exists; its symbol attachment layout is not a documented adapter contract                     | Isolated, adapter:106; contract checks all three actual encoder symbols |

There are **no imports from a Solid/web/router `dist/` path** in
`packages/compiler-yield/src`, including generated import strings. The only
non-public runtime import is `solid-js/internal`. `@solidjs/web/serialization/decode`
is an explicit public export, not a deep import.
The offline payload report (`reachability-data.js:9–13`) seeds `_$HY.r` in a
VM to read generated `$R` scripts; it is reporting code, not adapter/client
output, and imports no Solid internals.

The public frames exports were checked in the installed manifests, declarations,
and entry points: `createFrame`, `createFrameHost`, `createServerComponentHandler`,
`frameTransformDirectResult`, `renderServerComponent`, `renderToFrameStream`, and
`ServerComponentPlugin`. The server-functions configuration exports are public
on their respective server/client entries. `hydrate({renderId, owner})` can hydrate
a mount root; it does not supply an in-progress document's slot-range registry.
Client `Hydration` is a passthrough and cannot replace that registry switch.

The root-HTML wait, retained frame `rebind`, keyed slot update/cleanup, and
response handler use public APIs. Their ordering matters: `onApply` must observe
applied HTML, a rebound frame must accept the new address without `data-fid`,
and a disposed frame must stop receiving updates. The adapter contract checks
these behaviors; the route suite also checks response-header/body timing,
Like state through early arrival and refetches, seven RPCs, and no hydration RPC.
The router is not patched or privately imported. F-C18 raw-link over-claiming
and F-C19 ordinary TOC claim timing remain visible in the exact comparison.

## Upstream requests

**Document encoding and metadata.** Please let a server component use its authored
root element as its frame boundary during document SSR, without adding a
`solid-frame` wrapper. Keep Solid's slot serialization and component ID/source/
address handling inside the public operation. The current public document
transform fixes the outer template; stream rendering does not encode client
slots into a hydratable document. We currently swap its opening/closing template
records and copy its symbol properties, so both output shape and metadata need
a supported boundary.

**Claiming existing slot nodes.** Please expose a way to render a client slot into
its existing server-rendered comment range while claiming those nodes in the
current hydration pass. It should set and restore the slot's claim roots and
registry, retain the caller's owner, and clean up with the slot. Public `hydrate`
works at a mount root; public `createFrame` provides the slot's nodes but does
not give a custom slot renderer the scoped claim operation. We currently read
`_hk`, swap `sharedConfig.registry`/`claimRoots`, and restore them in `finally`.

**Document slot records and owner scope.** Please expose the slots belonging to a
document server-component call, with their occurrence keys, resolved arguments,
and hydration scope. Public `takeHydrationValue` safely reads a known key, and
`createOwner({id})` can enter a named scope, but neither tells an adapter the
`sc:slot:` key, `like#route-like` spelling, `sc-…-` prefix, or initial version.
The document encoder already knows these details; exposing a slot descriptor
would let an existing-element binding use them without copying rc.13's format.

**Custom document attachment.** Please let `installServerComponents` accept a
binding that selects an existing authored element and receives the call's
component ID, props, and changing frame address. Keep document registration,
preloads, and late address notifications inside Solid. `createFrame` can reuse
an element, and `createServerComponentHandler` can deliver responses, but the
public installer always builds its own frame element. Connecting those public
pieces to document calls currently requires replacing `_$SC.impl`, reading
`r`/`a`, and replacing `reg`.

**Host identity after attachment.** Please expose document host lookup and keep
frame identity outside authored attributes once attached, including after
rebind. The existing-element API is public, but the document path identifies
hosts with `data-fid`, and rebinding can write it again. Our bounded adapter
reads that marker and removes it after attachment and rebind; its contract
checks that subsequent HTML still reaches the element. A supported lookup and
identity policy would remove this last marker dependency without changing DOM.

## Verification and next bump

`compiler:solid-adapter-contract` is a separate gate step. It runs before the
other steps; if it fails, `compiler:emission-test` is skipped with the cause
"frame adapter contract failed". Other checks still run. The baseline is not
changed. The contract uses the installed public document encoder and bootstrap,
then hydrates its actual slot DOM. It checks node identity and interaction,
private state restoration on an exception, missing-record rejection, component
metadata preservation, opening-tag rejection, frame application/rebind/disposal,
and simulated version mismatch at server/client module load for each package.

For a bump, first run that contract with the old allow-list and confirm the
installed-version error. Revalidate the upstream changes in a local branch,
then update the single-version allow-list and the contract expectations only
when the tested release is supported. Run the full route suite and the same
40-step exact/content comparisons; keep the existing normalizer and baselines.
If client output changes, repeat all three byte runs. D-082 records rc.13
behavior and next-bump retesting; it contains no rc.14 hold note in this checkout.
This task does not bump dependencies or change the `/profile` workaround.

```sh
node --test packages/compiler-yield/test/solid-adapter.test.mjs
DOCS_LEVEL=L C4_SNAPSHOTS=/tmp/adapter-after.json \
  node --test packages/compiler-yield/test/server-components.test.mjs
DOCS_LEVEL=L node examples/harness/executed-bytes/hydrated-docs.mjs \
  --regions --runs 3 --record documentation/compiler-adapter-L-bytes.json
pnpm build
node scripts/yield-gate.mjs --baseline documentation/yield-gate-baseline.json
```

The two public replacements were checked separately: each kept **6/40 exact
matches and 40/40 authored-content matches**. Both also retained plain Solid /
library equality at 40/40.

Before the implementation commit, `pnpm build` passed and the full gate was
**GREEN: 54 pass / 0 fail / 0 skip in 357 seconds**, including the new adapter
contract. No baseline or dependency was changed.

## Final DOM and bytes

Implementation: `822c8d4` (`fix(compiler): guard the Solid frame adapter contract`).
[The final parity record](compiler-adapter-parity.json) keeps the exact comparison
separate from diagnostic removals. Exact matches remain **6/40** (checkpoints
0, 1, 2, 3, 23, 31); authored content is **40/40**; plain Solid and the library
match **40/40**. All 40 compiled checkpoint hashes equal the retained C4c record.
No wrappers or permanent frame attributes appear, and the seven region RPCs
and direct-route hydration checks remain intact.

[Three fresh level-L byte runs](compiler-adapter-L-bytes.json), using the same
production module-runner method and 40 steps as C4c:

| Variant               | Load executed | 40 steps executed | Shipped raw JS | Shipped gzip |
| --------------------- | ------------: | ----------------: | -------------: | -----------: |
| Original              |     1,096,058 |         4,366,734 |        627,380 |      189,329 |
| Library               |     1,129,164 |         4,556,267 |        642,400 |      193,576 |
| Single root without R |     1,150,804 |         4,566,492 |        640,952 |      193,435 |
| Single root + R       |       622,435 |         4,069,761 |        232,882 |       81,152 |

There is **zero drift** in all 164 executed phases and each variant's raw/gzip
shipping totals. Against C4c, R adds **547 load-executed bytes**, **1,161 raw
shipping bytes**, and **359 gzip bytes**; 40-step execution is unchanged.
The version checks and public readers have a small byte cost. R still saves
506,729 load-executed bytes and 112,424 gzip bytes against the library.
Shipping excludes HTML, CSS, and RPC bodies; executed bytes are UTF-8 source
ranges, not CPU time. No measurement baseline was raised.

Before the evidence commit, the build passed again and the full gate was
**GREEN: 54 pass / 0 fail / 0 skip in 393 seconds**. Both local commits were
made on `proto/compiler` after a green full gate. No push, main change,
dependency change, or baseline regeneration was made.
