# Server signals: the v0.5 goal (D-118)

Status: **goal, decided 2026-10-13 (D-118); no implementation, no branch.** This note records what v0.5 is, how much of it already exists in the repository, what is new, where it can break, what must land first and what is measured before any code is written. It is a C0-style design note, not a release commitment: the order in D-116 stands, and v0.5 follows v0.3 (islands) and v0.4 (the lazy builder).

Read with `compiler-c0.md` (provenance, the capture rule, the R region), `calculus.md` (§1.3 hosts, §3.2 where each host runs, §7 what the compiler route must preserve), `yield-library.md` §7 (what the library route cannot do) and D-113/D-114 (the four tiers and the measured islands threshold). The outside reference is Ryan Carniato's note "Server Signals as Architecture" (HackMD, 2026), whose six closing rules this note restates in the project's terms; §8 records where the two differ.

## 0. The goal in one paragraph

One reactive graph, placed across the server and the client by the compiler. A cell whose setter is never delegated to on the client is a **server cell**. A derivation that reads only server cells is a **server derivation**: its code never ships, it recomputes on the server when a server cell is written, and only its settled value, or the markup it renders, crosses to the client. A derivation that reads any client-written cell is a client derivation, as today. Events stay client hosts and interceptable. The server may write its own cells, from a server function called by a client event or from a server-side source such as a database update, and the propagation continues on whichever side owns the next node. Where an edge crosses sides, the value crosses under the capture rule, and the read on the far side is a pending read. The output for a page whose graph is mostly server-owned is smaller than islands and smaller than resumability, because neither the derivations' code nor a client renderer for them ships.

## 1. The rules, in the project's terms

The note's six rules, each with its C0 counterpart and what it needs.

| # | Rule (as stated in the note) | C0 counterpart | New |
| --- | --- | --- | --- |
| 1 | Signals are isomorphic: they live on both sides and either side may write them | a cell; `yield* setX(v)` is the only write, admitted in an event or effect phase (§1.1) | a **server-write host** (§3.1): today every writing host runs in the browser |
| 2 | Effects are client only; the compute half maybe not | `$effect(compute, effect)` (D-079): the compute is pure and tracked, the effect phase writes | none: the compute phase is placed by provenance, the effect phase is client |
| 3 | Derived values are isomorphic or server only | a memo's provenance S / R / U / C (§1.2); S and R regions never ship | a **client pin** (§3.2) for a memo the author wants on the client although its inputs are server-owned |
| 4 | A signal whose setter is never called from the client is a server node | a cell is C only if written by a reachable event or effect phase; otherwise it has its initial value's π | the same rule with a server-write host: a cell written only on the server stays server-owned for the session, not just for the request |
| 5 | A derivation reading only server nodes needs no sources serialized | pure derivations of S/R are S/R; memos are atomic (R3), so one C read makes the whole memo C | none; the region is the downward closure of server cells cut at every join with a client-written cell |
| 6 | Only the intersection of server and isomorphic nodes is serialized | the capture rule (§1.6): the settled value at the selected path crosses, never its producer, closure or code; failures keep their class (D-117) | a **value patch** transport (§3.3) beside the markup frames R emit uses today |

A hole is placed like a memo. A server-placed hole is a server-rendered slot the client places and does not render; a client-placed hole updates the DOM from values. This is how islands (C3) and this goal are one model: islands are the case where every placed hole is a markup slot.

## 2. What already exists

| Piece | Where | State |
| --- | --- | --- |
| Writes are syntactic; writer sets per cell over the module graph | `packages/compiler-yield/src/analysis.js`, C0 §1.1 | on main, nine-twin reports |
| S / R / U / C provenance, memo atomicity, argument vectors in first-read order | `recomputable.js`, C0 §1.2 | on main |
| The capture rule and its public-codec check | `capture.js`, C0 §1.6 | on main |
| Per-event directed reach (what one interaction touches) | `reachability.js` (C1b) | on main |
| `"use pure"` trust model for opaque calls | analyzer, F-C12 | on main; author assertion, not checked |
| R emit: generated `"use server"` functions returning markup, slots, refetch | `proto/compiler` (C3–C4c) | measured, parked (D-114); exact DOM parity gated on frames |
| Server-pushed values into a memo or optimistic store | room's `live(GET(async function*))` sources, D-091 streams | on main; one connection per source |
| Failures across stream and RPC edges keep their class | D-117 | on main |
| Pending as the color of a cross-wire read; transitions keep the old state | the calculus, Solid 2 async memos | on main |
| Stable per-view ids | compiler-route hydration scopes (D-069 F6, D-082) | on `proto/compiler` |

So rules 2, 4, 5 and 6 are implemented for the request-time case. The goal is the session-time case.

## 3. What is new

### 3.1 A server-write host

Calculus §1.3 has no host that writes on the server; §3.2 says an event is always client. v0.5 adds a **server event**: a routine that runs on the server, admits writes, and is entered from a server function called by a client event, or from a server-side source (a timer, a subscription, a database change). Its writes give a cell the provenance **server-owned C**: written, so not S, but written only where the server runs. A cell with both a client writer and a server writer is a conflict the checker refuses unless the author names an owner; one writer side per cell is the sound default, and C0 already states it as "a server call cuts data provenance, never ownership or writes".

The proof obligations in `calculus.md` §5 do not cover this host. Adding it is model work before emitter work: §1.3, §3.2, §3.3 and the §5 matrix, then the Lean obligations that mention hosts.

### 3.2 Placement annotations, checked

Default placement is inferred from provenance. Two annotations override it and are **assertions the checker verifies**, in the project's style (colors are sound upper bounds, D-071):

- a **server memo**: the author pins a memo to the server although it reads client-written cells. Its argument vector ships up under the capture rule; its readers see a pending read. Refused when an input is not serializable, when the body reads a browser API, or when it reads a value the capture rule rejects.
- a **client memo**: the author pins a memo to the client although its inputs are server-owned. Its inputs' settled values ship down. Refused when an input is not serializable.

In native mode the natural surface is a directive as the first statement of the memo callback, `"use server"` and `"use client"`, which the lowering can read before reconstructing the routine. In the yield dialect it is an option on `$memo`. Neither is decided; see §7.

### 3.3 Transport: value patches and one multiplexed channel

R emit ships markup through frames. v0.5 also needs **value patches**: a server derivation's settled value, keyed by node id, applied by a thin generic client runtime that knows nothing about the app. Server-initiated writes need a standing connection; one connection per source, as `live()` does, does not scale to a graph, so one **multiplexed channel** carries node-keyed patches both ways, and the client's subscription set follows disposal: a disposed row unsubscribes (the D-109 lesson, applied to pushes).

Markup slots and value patches are both legal for a server-placed hole; which is cheaper is measured, not ruled (§6).

### 3.4 Instance count

The provenance of a server region's inputs decides how many instances the server runs:

- inputs are only global server cells: **one instance**, its patches broadcast to every subscriber;
- inputs include request or session data (route params, identity): **one instance per key**;
- inputs include client-shipped arguments: the R recompute, **per client, per write**.

Only the last is per-client work. This is a property LiveView-style per-client graphs do not have, and it is the strongest reason to prefer the compile-time coloring over the note's run-time "propagate until a server node, then ship the impacted subgraph" scheduler.

## 4. Holes, and the answer to each

1. **Glitches across the cut.** Client cell `a`, server memo `m = f(a)`, client memo `v = g(a, m)`: `v` would rerun with the new `a` and the stale `m`. Answer: a server-placed value is never read synchronously on the client. The read is pending while the recompute is in flight and the whole recompute is a transition. The types already say this; the checker must refuse a synchronous read.
2. **Ownership.** One writer side per cell (§3.1). A client that needs to change a server-owned cell calls a server function from an event, as actions do today.
3. **Where the server graph lives.** Stateless R recompute from a serialized input vector, or a live graph per instance key (§3.4). A server-owned cell that persists between requests is a product decision: per session, per key or global. It is not decided here.
4. **The joins are high in real apps.** D-113: every original twin is one connected group; room provides the client-minted identity above everything; the dashboard's `range` and `team` filters are client signals read by every panel, so `summary` and the whole panel tree are C. The region a compiler can keep on the server is set by where client-written cells sit, and the analyzer's leak and eager-cause reports are what tell authors where to move them. The checker does not fix an app's shape.
5. **"Doesn't ship" means app code, not all code.** A thin patcher or the frames runtime ships once. The frames fixed cost near 25 KB gzip set the islands break-even (C3c); value patches change that cost and must be re-measured.
6. **Client reads of server values.** An event that reads a server-placed memo needs its current value in the browser: the value crosses, the code does not (the S row of §1.6). An effect compute that reads one makes its root eager and pulls the value at load.
7. **Payload per update.** A server derivation that recomputes a large list ships the whole list unless it is diffed; room's reconcile-by-id through `$optimisticStore` is the pattern. Serialization and deduplication of derived chains is the note's stated risk and the gate's executed-bytes harness is where it is checked.
8. **Hydration must skip server regions.** Solid's hydration runs every component, so a region with no shipped code is a slot Solid does not walk. That is islands, gated on frames and F-C11 exact-DOM parity. v0.5 does not route around that gate; it depends on it.
9. **Escaped setters.** A setter handed to foreign code, a timer or a prop the analysis cannot follow counts as written on the client. The capture rule already refuses a function at an edge; the same rule makes the region client.
10. **Trust.** A server memo's inputs are client-supplied, so it is an endpoint with validated arguments. A server-owned value that feeds a client memo can leak server-only data: capture handles what *can* cross, not what *may*. A secret provenance letter is a candidate, not part of this goal.
11. **Optimistic updates.** Server-derived values meet ephemeral client state there, and nothing is saved on serialization. They stay client, which is the client pin's purpose, and the note concedes the same.

## 5. Prerequisites and order

v0.5 comes after, and depends on, the three releases in D-116's order:

- **v0.2 sugar** supplies the native surface and the checker that reports placement refusals at the author's line. Native mode is bounded at F-S37 today; placement stacks on the lowering, not beside it.
- **v0.3 islands** supplies the server-placed hole (a slot the client does not render), the R emitter, the frames or replacement transport, exact DOM parity and the purity trust model. Without it a server region cannot skip hydration (hole 8).
- **v0.4 the lazy builder** supplies descriptors, keyed attachment and stable ids on the library route, which value patches key on (§3.3), and the client's own event queue and payload.

Tier 4 in D-113, full resumability with the library's own runtime, is the horizon this goal moves toward: a page whose graph is entirely server-owned needs no client renderer at all. v0.5 does not claim tier 4; it leaves D-004 only where v0.3 already does.

## 6. Acceptance: measure before building

Two numbers decide whether v0.5 pays, and both can be taken with a provisional server-write host in the analyzer before any emitter exists:

1. **Server-closure fraction.** For each of the nine twins plus the dashboard original: the fraction of holes and JSX sites in the server closure after the joins are cut, with the joins named (which client-written cell cut which region). Room first, because its presence and transcript are already server-pushed; the dashboard second, because its filters show the join problem in its purest form.
2. **Payload per update.** For room's transcript and the dashboard's summary panel: bytes per server write as a value patch, as a markup frame, and as the library route's client recompute, over a scripted session, in the executed-bytes harness.

Three behavioural fixtures, from the note's examples, pin the semantics before the transport exists:

- **HN comment toggle.** A client cell driving a style: no round trip, no page data serialized. The same cell driving a `Show` over server-rendered children: the client places a slot it already has; no round trip either. The note's version makes the second a server render; this design does not.
- **Formatted date.** A client formatter over a server-owned user: the date at its selected path crosses, not the user, and nothing goes back to the server.
- **Profile rearrangement.** A client cell choosing which server-rendered arrangement shows: a server round trip returning markup, with no user serialized.

Stop rule: if the server-closure fraction on room and the dashboard, after reasonable author restructuring, is below what C3c measured as the islands wash point, the goal is re-ruled before an emitter is written.

## 7. Open rulings for Dev

- **Numbering.** This note takes v0.3 = islands and v0.4 = the lazy builder from D-116's order; D-113 and D-114 called the lazy builder v0.3 before D-116 reordered. Confirm.
- **Annotation surface.** Directives inside memo callbacks in native mode, an option on `$memo` in the dialect, or inference only with no override.
- **Server-owned cell lifetime.** Per session, per key, global, or author-declared; and whether the server keeps live instances (§3.4) or recomputes statelessly as the default.
- **The dynamic fallback.** Whether the note's run-time scheduler (propagate on the client until a server node, batch, ship the impacted subgraph) is in scope as the fallback for U regions, or U stays client as today.
- **Conflict rule.** Refuse a cell with writers on both sides, or let an author name an owner.

## 8. Relation to "Server Signals as Architecture"

Same: rules 1, 3, 4, 5 and 6; events stay client; server events; stable ids and a resumable-style client output; serialization granularity and security as the named risks.

Different:

- the note starts from a LiveView-like premise, all new element rendering on the server, and places by node kind (`For`, `Show`, async); this design places by provenance and writer side, and keeps client rendering first-class through the client pin, so optimistic flows do not fall outside the model;
- the note decides what ships up at run time, by propagating until a server node and serializing the impacted subgraph; this design decides at compile time with a fixed argument vector, which over-approximates conditional reads and removes the double-serialization risk;
- the note assumes a persistent connection and a live server graph per client; this design treats the instance count as a consequence of input provenance (§3.4), with stateless recompute available;
- the note expects no client renderer at all, which is tier 4 and leaves D-004; this design reaches that only on the horizon route.

What this repository answers that the note leaves open: the compile-time coloring (provenance is syntactic because every read and write is a `yield*`), composition (per-component summaries instantiated per call site, §2.3), the effect split (compute by provenance, effect phase client), what the user sees during a round trip (the pending color and a required `Loading`), failures across the wire (D-117), and the HN toggle over server-rendered children (a placed slot, not a round trip).
