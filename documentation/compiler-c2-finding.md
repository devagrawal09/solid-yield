# C2: delayed Solid hydration is not the v0.2 path

The public-API namespace spike on proto/compiler preserved both independent server buttons when both roots hydrated synchronously. After a timer turn, a second hydrate replaced its button without a warning. Its test pins node identity, not just markup or interaction. See [solidjs/solid#3845](https://github.com/solidjs/solid/issues/3845).

**D-111: withdrawn before implementation.** Dev considered resetting Solid's private _$HY.done flag; the maintainer says the guard is deliberate because delayed hydration cannot safely preserve event replay, serialized-data lifetime and DOM claims. No reset was implemented.

v0.2 ships eager islands only, on Solid hydration under D-103's capture rule, effects-make-eager and per-root claim checks. Lazy and visible are report classes. This replaces the prototype's earlier "C2 blocked waiting for delayed hydrate" conclusion. The prototype's delayed test remains evidence of Solid's deliberate behaviour, not a supported attachment path.

v0.3's lazy builder will attach by key without Solid's hydrate: its own delegated event queue and serialized payload, validated claims and render fallback. No such builder or C2 codegen is emitted on main by this docs/type-repair work.
