---
"solid-yield": minor
---

`foreign(Comp, { provided: [Ctx, …] })` (D-102): a yield component handed to plain Solid may list the contexts provided above the foreign edge — typically an app-wide `Ctx.provide` around a router whose route renders it. The type takes them off the component's requirements before `foreign`'s `[NO_PROVIDER]` check (what remains is still refused, named, and the message now points to `provided`); listing a context the component does not require is refused, `[NOT_REQUIRED]`, naming it. The runtime checks the claim where the component is created: with no provider above, its setup's read is `NO_PROVIDER`. Exported types `ForeignOptions` and `ProvidedCheck`. Before, an app-wide context could not be typed through a router: each route page had to provide it itself, or the handoff was cast.
