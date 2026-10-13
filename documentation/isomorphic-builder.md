# The isomorphic builder: one mechanism, two hosts

Status: **design note, 2026-10-13; nothing implemented.** Companion to [server-signals.md](server-signals.md) (the v0.5 goal, D-118). This note takes D-113's tier 3, "resume(root) on Solid's public API in the library: descriptors, keyed attachment and materialization on first interaction, with the library's own event queue and payload, validated claims and render fallback", and shows that the same mechanism is the server runtime of v0.5. It proposes that v0.4 build it once, host-agnostic, with a client acceptance and a server acceptance, instead of building the client use first and porting later. D-118 still names the lazy builder as a prerequisite that precedes v0.5; the amendment this note argues for is in §9 and is not yet ruled.

Read with `calculus.md` §3.2 (where each host runs) and §3.4 (propagation), `compiler-c0.md` §1.1 (parts), §1.2 (provenance) and §1.6 (the capture rule), D-074 (the two routes' hydration keys differ), D-081 (an event call is one transaction), D-091 (streams), D-109 (disposed bind boundary; keyed re-delivery), D-113 (tier 2 rejected: delayed Solid hydrate is unsafe) and D-117 (failures across the wire).

## 0. The claim

A **builder** takes a **descriptor** of a region of the reactive graph and the **captured state** at that region's edges, and **materializes** a live subgraph on Solid's public API, **attached by key** to something that already exists, with a **queue** for inputs that arrived before materialization, **validated claims** on what it attaches to, and a **fallback** that rebuilds the region when a claim fails. Nothing in that sentence names a browser.

| Builder step | Client host (the lazy builder as D-113 names it) | Server host (v0.5's runtime) |
| --- | --- | --- |
| what exists already | server-rendered DOM | an instance in a store, keyed by input provenance |
| attached by | the library's own anchor ids in the markup | the instance key |
| the inputs that arrive early | DOM events, before the region exists | writes and RPC argument vectors, before the instance is live |
| the trigger to materialize | first interaction, or visibility | a write to a server cell, or an RPC |
| the output | DOM updates | patches: settled values or markup, to subscribers |
| the claim | the anchor's node is there and matches | the stored state's version matches |
| the fallback | re-render the region into its anchor | full recompute from the serialized inputs |
| disposal | the region's owner is disposed; unsubscribe | no subscribers, or a TTL; serialize the state back |
| the degenerate case | an eager region materialized at load | the request render: materialize all, record, serialize, dispose |

The shared parts are the descriptor format, the capture format, the materialize step, the queue semantics and the claim protocol. The host-specific parts are attachment, the sinks and the lifetime policy. §7 maps these onto modules.

## 1. The descriptor

A descriptor is a serializable record of a **region**: a connected set of C0 §1.1 parts with its edges, cut at the places where values cross.

- **Nodes.** Each part with its id (§2): cells (owner side, initial or captured value, version), memos (host kind, placement, input ids, a code reference), holes (anchor id, input ids, placement), binds (event id, DOM site), events (code reference, the cells it writes, the server functions it calls, whether it calls `preventDefault`), effects (compute inputs; the phase marks the region eager, D-104), rows (the flow control, the row key, a row descriptor template), boundaries (`Loading`; `Errored` with its catch classes by D-117 registered id), providers (context id and the node that gives the value).
- **Edges.** reads (node to node), writes (event or effect phase to cell), calls (event to event, event to server function), creates (hole to component instance), places (hole to slot).
- **Code references.** For a memo, event or effect: a chunk and an export, by build hash, the "###" in the outside reference. The client loads the chunk when it materializes; the server has every chunk.
- **Edge state.** The ids of the nodes whose values cross into the region, with their captured values (§3).

**Where the edges come from matters.** Solid tracks dependencies dynamically: a memo's inputs are whatever it read on its last run. A descriptor recorded from one run under-approximates the possible reads on another path. For the client host that is harmless, since materialization runs the real setup, which tracks again. For the server host it is unsound: "which regions does this write reach" must be an over-approximation, or a write misses a region that would have read it on the next path. So the server host's edges are the **analyzer's static edges** (C0 §2.2 per-file facts, C1b directed reach), which already exist on main and over-approximate conditional reads. The library route therefore records ids and values at the request render and takes edges from the analyzer; the compiler route emits the whole descriptor statically. Either way the analyzer is a prerequisite of the server host, which is one reason the builder does not wait for the compiler but does need the analysis tool.

## 2. Ids

The builder needs ids that are stable across the server and client builds, across row instances, and ideally across the two routes and across builds. Solid's hydration keys fail the third: D-074 records that the library route numbers owners and the compiler route numbers view scopes, so a page rendered by one cannot be hydrated by the other. They also fail the fourth, since they are positional. The builder's ids are the library's own:

- a **site id**: a hash of the module, the component name and the static site index of the part. The transform already rewrites every hole under its one rule and can stamp the site id there; the compiler route's scope per view is the same thing emitted statically;
- an **instance path**: the chain of row keys and call-site indices from the root. A row needs a key the author names; a stable index under the list's identity is the fallback and is weaker, since a reorder re-keys every row. This is an open ruling (§10).

A node id is the site id plus the instance path. The client's anchor attribute carries the hole's node id; the server's instance store is keyed by region id plus the instance key (§5.2). Solid's hydration keys stay what they are for the eager root; the builder never reads them.

## 3. Capture

What crosses an edge is what C0 §1.6 says crosses, checked by `capture.js` against the public codec: a settled serializable value at its selected path, never its producer, closure or code; a failure as its registered class (D-117, through `prepareFailure` before transport); a pending value as a stream, which Solid already does for async memos at the request render. The builder adds one field: a **version** per cell, a monotonic counter advanced by each committed write on the owning side. Versions give patch ordering (§6.3) and the server's claim (§5.4).

A value the codec refuses does not cross. On the client host the region grows to include the producer, as the capture rule already says. On the server host it is a refusal at the author's line, because the alternative is a server region that cannot be rebuilt from its inputs.

## 4. Materialize

`materialize(descriptor, state, host)`:

1. `createRoot` on the host, under the owner the descriptor names (the holding hole's owner on the client; the instance root on the server).
2. Cells from captured values at their captured versions. A cell owned by the other side is read-only here: on the client a server-owned cell is a stream source under D-091, fed by the channel; on the server a client-owned cell is a constant at the captured value of this write's argument vector.
3. Memos from their code references, inputs wired by id. On the library route this runs the region's setups, which is lazy hydration: client code runs, server code does not, because the server-owned inputs stand in as captured values. Running no setup at all, building the graph from per-node code as the outside reference's `registerRenderEffect` output does, is tier 4 and needs the compiler to emit per-node code; the builder's descriptor format is designed to carry that later without changing shape.
4. Holes attached by the host: on the client, claimed DOM nodes by anchor id; on the server, patch sinks by node id.
5. Binds installed; the queue drained in order (§4.1).
6. Claims validated before the subgraph is trusted (§4.2).

### 4.1 The queue

Inputs that arrive before the region exists are held in order and replayed after materialization. On the client they are events; on the server they are writes and RPC argument vectors. The ordering rule is D-081's: each event call is one transaction, and replay preserves arrival order, so two clicks before materialization run as two transactions in the order they happened. On the server the same rule orders two writes to one cell: each commits a version, and the later one wins (§6.3).

Replaying a DOM event has one known limit. `preventDefault` on a replayed submit is too late, since the form already submitted. The delegated listener (§5.1) calls `preventDefault` at arrival for an event whose descriptor says its handler calls it, which is a syntactic fact the analyzer can record. A bind whose handler the analysis cannot read, a foreign one, makes its region eager, which is the existing rule for anything unanalysable: the fallback is the library route.

### 4.2 Claims and fallback

A claim is a check that what the builder attached to is what the descriptor expected. On the client: the anchor node exists, and its tag and a short content checksum match the descriptor. On the server: the stored state's version is the version the write was issued against. A failed claim never corrupts: the client re-renders the region into its anchor from the captured state, replacing the DOM; the server recomputes the region from the serialized inputs. Both are D-113's "validated claims and render fallback"; the server one is the R recompute.

## 5. The two hosts

### 5.1 The client host

**Lazy regions are rendered outside Solid's hydration walk.** D-113 tier 2 rejected delayed Solid hydrate, and #3845 was closed as by design, so the builder cannot leave a region for Solid to hydrate later. Instead the request render emits a lazy region as plain markup with the library's anchor ids and without Solid's hydration keys, as `@solidjs/web`'s `NoHydration` does, which is public API. The eager root hydrates through Solid as today. A lazy region is then attached by the library's own claims, which is the Qwik-shaped half of resumability on the library route, and it is why the lazy builder "does not depend on delayed Solid hydrate".

**Delegation and queueing.** One document-level listener, installed by the eager root, receives events for lazy regions, identifies the bind by the anchor id on the target, calls `preventDefault` where the descriptor says so, and queues the event. Materialization loads the region's chunk, runs §4 and drains the queue.

**Sinks.** A hole's sink is a DOM insert at its claimed anchor. A server-owned cell's sink is the stream source the channel feeds.

**Eagerness.** A region containing an effect phase, or a bind the analysis cannot read, is eager (D-104): materialized at load, with no queue.

**Cost.** This changes the server markup of lazy regions: no `_hk` keys there, an anchor attribute instead. The parity normalizer and D-082's measured key bytes change accordingly; the gate's exact-DOM snapshots must be re-baselined for lazy regions, under the same rule that re-baselined C4b's authored-element hosts.

### 5.2 The server host

**Instances.** A region's **instance key** is decided by the provenance of its inputs (server-signals.md §3.4): no request or client inputs, one global instance; route or session inputs, one instance per key; client-shipped arguments, one per client per write. The store holds, per (region id, instance key), the server-owned cells' values and versions and the subscription set (which client channels hold which node ids).

**Materialize on demand.** A write to a server cell enters from a **server event host** (the calculus addition in server-signals.md §3.1): a server function called by a client event, or a server-side source such as a database subscription. The builder finds the regions downstream of the cell by the descriptor's static edges, the runtime use of C1b directed reach, and for each affected instance with at least one subscriber: materializes it if it is not live, applies the write as one transaction, runs, collects the outputs, and ships them. The rest of the graph stays serialized. That is first-interaction laziness with a write as the interaction.

**Sinks.** A node whose value crosses to a client-placed reader has a value sink: its settled value and version, as a patch. A server-placed hole has a markup sink: the hole's view rendered through the server renderer, with the same anchor ids, as a slot patch. Which sink a hole gets is placement; v0.5 decides it by provenance and the two annotations. Before v0.5, every hole is client-placed and every sink is a value sink, which is enough for the v0.4 acceptance.

**Lifetime.** Stateless and stateful are one code path: whether `dispose` runs after the run. Stateless disposes always, which is the R recompute from a serialized input vector and the default when no server-side source can write the region's cells. Stateful keeps an instance live while it has subscribers and under a TTL, and serializes its state back to the store on disposal, which is what "resume on the server" means. A region with a server-side writer needs stateful instances; one driven only by client writes does not.

**The request render.** SSR is the degenerate case: materialize every region once for the request, record the descriptors' ids and values, serialize the descriptor set and captured state into the page with Solid's public serializer, and dispose. On the library route this run is the recorder (§1); on the compiler route the descriptors are static and the run only captures values.

## 6. Two writes, end to end

### 6.1 A client write that reaches the server

The dashboard original, as v0.5 would place it: `range` is a client cell written by the filter bar; `summary` attempts `getSummary(range)` and the author pins it as a server memo; `totals` is a pure derivation of `summary`; a panel hole reads `totals` and is server-placed; the filter bar's own highlight hole reads `range` and is client.

1. The click runs the filter's event on the client. `yield* setRange("7d")` commits `range` at version 4 in the event's transaction (D-081).
2. Propagation on the client reaches the highlight hole, which updates synchronously, and reaches `summary`, which is a server-placed read. Its reader sees pending; the recompute is a transition, so the panel keeps showing the old totals.
3. The client builder batches the write's argument vector for `summary`, `[range@4]`, and sends one RPC. This is the generated server function of the R region, with the vector checked at the edge by the capture rule.
4. The server builder materializes `summary`'s region for this client's instance key, with `range` as a constant at `"7d"`, runs `summary` and `totals`, and collects the panel hole's markup sink. It disposes the instance, since nothing server-side writes these cells.
5. The RPC response is the patch set: `summary@…`, `totals@…` as values if any client reader needs them, and the panel slot's markup. The client applies them by node id, the pending read resolves, and the transition commits.

Nothing in this trace is new to the runtime except the two sinks and the pending read on a server-placed memo; the RPC, the capture check and the R function exist on `proto/compiler`.

### 6.2 A server write that reaches the client

Room's transcript, as v0.4 would build it: `messages` is a server-owned cell for the room, written by the `post` server function; `transcriptRows` on the client is an optimistic store over it; the row list is a client-placed `For`.

1. Tab A's send event calls `post(room, text)`, an RPC. On the server `post` runs as a server event host and commits `messages` at version 12 for instance key `room`.
2. The server builder finds the regions downstream of `messages` by static edges, finds instance `room` live with two subscribers, tabs A and B, applies the write, runs, and collects `messages`'s value sink.
3. One patch, `messages@12`, goes down the channel to both subscribers. Tab A's RPC response also carries it, so A does not wait on the channel.
4. Each client's stream source for `messages` yields the value; the optimistic store reconciles by id as room does today; the send event's `until` wait settles when the transcript carries the sent message, as it does today.
5. Tab B closes. Its channel ends; the server removes its subscriptions; the instance keeps running for A. A navigates away; the instance has no subscribers; its state is serialized back to the store and it is disposed. The next subscriber materializes it from that state.

Steps 1 through 4 are what room's `live()` does with one connection per source; the builder replaces the per-source connection with the instance store and the channel.

### 6.3 Ordering

Every patch carries the cell's version. A patch at or below the version the client holds is dropped, which is D-080's rule, a superseded run completes and is discarded, applied to the wire. A client write's pending read resolves when a patch for the server-placed node arrives at a version at least the one the write was issued against. A server-initiated patch that arrives during a client transition applies after the transition in version order. Two clients writing one server cell commit two versions in the server's transaction order, and both see both patches in that order.

## 7. Shared and host-specific modules

| Module | Side | Holds |
| --- | --- | --- |
| `builder/descriptor` | shared | the schema; static edges from the analyzer; recorded ids and values from the request render |
| `builder/capture` | shared | edge serialization through the public codec; versions; D-117 failure transport |
| `builder/materialize` | shared | descriptor and state to a live subgraph on `createRoot`; the claim interface; the fallback hook |
| `builder/queue` | shared | ordered replay of early inputs, one transaction each |
| `builder/channel` | shared | the patch encoding; subscriptions by node id; version checks |
| `client/attach` | client | claims by anchor id; validation; re-render fallback; DOM sinks |
| `client/delegate` | client | the document listener; `preventDefault` by descriptor; the event queue |
| `server/instances` | server | the store; instance keys; lifetime and TTL; serialize-back on disposal |
| `server/run` | server | materialize on a write; directed reach over static edges; value and markup sinks; the server event host's transaction |
| `server/record` | server | the request render as recorder |
| compiler, later | build | static descriptors; placement; code elision (v0.5) |

The decisions that must be made once, for both hosts, before either is built: the id scheme (§2), the descriptor's edge source (§1), the capture format with versions (§3), the queue's transaction order (§4.1) and the claim protocol (§4.2). Building the client first would decide each for the browser alone: positional ids, recorded edges, no versions, event-shaped queues, DOM claims. The server host would then redo all five, which is how D-074 ended with two incompatible hydration-key schemes.

## 8. Risks specific to the builder

- **Markup of lazy regions changes.** No Solid hydration keys in them, an anchor attribute instead; parity snapshots and D-082's key measurements re-baseline for those regions. The eager root is unchanged.
- **Event replay fidelity.** `preventDefault` is handled by descriptor; focus and selection inside a region whose claim fails and is re-rendered are lost. A region whose claims fail often should be eager, and the development build should say so at the anchor.
- **Under-approximated edges on the library route.** Recorded edges are only ids and values; the server host must take edges from the analyzer or it misses regions on a write. The development build can check: a materialized region that reads a node the static edges did not list is a finding at the read.
- **Server memory.** Stateful instances are bounded by subscribers and a TTL, and serialize back on disposal. The instance key by provenance keeps global and per-key regions to one instance each; only client-argument regions are per client, and those are stateless.
- **Payload.** Versions add a few bytes per patch; large values need the reconcile-by-id pattern or a diff codec. The executed-bytes harness is where this is measured, not assumed.
- **Security.** A subscription is a capability: a client may subscribe only to node ids of instances its session may read, and a server event host validates its arguments like any server function. The channel carries a session token; a patch never carries code.
- **The proofs.** The client host changes only how and when a region is built, which §7 of the calculus permits. The server host is a new host and extends §1.3, §3.2, §3.3 and the §5 matrix; the Lean obligations that mention hosts are re-done. This is model work before emitter work.

## 9. What this means for the roadmap

The accurate statement is: **v0.4 is the isomorphic builder; v0.5 is the compiler cut on top of it.** The lazy builder's load-time gain is still real and still the smaller reason to build it; the larger reason is that it is v0.5's runtime on both sides. D-118 names the lazy builder as a prerequisite that precedes v0.5 for its ids and event queue; the amendment is to name v0.4 as the builder built isomorphic from the start, with two acceptances (§9.1), and the server-write host landing with it. D-116's order is otherwise unchanged, and the measurements in server-signals.md §6 still come first and still need no builder.

### 9.1 Acceptance

- **Client, docs twin.** The analyzer's lazy and visible report classes become lazy regions; the 24 parity steps hold; executed bytes at load drop by about what D-113 estimated for content pages; fixtures for a click before materialization, a submit whose handler prevents default, and a failed claim's fallback.
- **Server, room twin.** Presence and transcript as server-owned cells with a per-room instance key; two tabs are two subscribers of one instance; a post is one patch to both; the chaos knob's disconnect becomes an unsubscribe and resubscribe with versions; parity against room's original live page.
- **Shared.** One descriptor-schema fixture used by both hosts; capture tests with versions; queue tests for transaction order on both hosts; a claim-failure fixture on both.

## 10. Open rulings

- **Row keys.** An author-named key on `For`, a stable index under the list's identity, or both with a diagnostic when a region under an unkeyed list is lazy.
- **The author surface for a server-owned cell.** Keep `live()` as the surface and let the builder sit under it, or a dialect primitive with the server event host as its writer.
- **Lifetime defaults.** Stateless unless a server-side writer exists; TTL; whether serialize-back is on by default.
- **The channel.** Server-sent events plus RPC up, or a websocket; one per tab or shared through a worker.
- **Foreign binds.** Eager always, or an author assertion that the handler does not prevent default.
- **The amendment to D-118** in §9.
