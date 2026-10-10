# Probe (not a bug repro): root diagnostics through @solidjs/router 2.0.0-next.29

opencode-web declares @solidjs/router but never imports it, so this probe uses the Router 2.0 API the way
opencode's own app would (`createRouter` + `defineRoute`, a session page per route, an async SDK-style call in a memo).

Command: `./node_modules/.bin/solid-yield check .`

Actual (2 errors, 1 warning):
- `SessionPage.tsx:8:21 [FOREIGN_HANDOFF] Wrap this rendered work in Errored … Remaining: TypeError | DOMException | Error.`
  related `main.tsx:11:52: The app is rendered here. can suspend (pending); can fail with TypeError | DOMException | Error`.
  Precise: `fetch` → TypeError | DOMException, `throw new Error` → Error. Reported at the read, related to the route.
- `direct-root.tsx:10:18 [PENDING_ROOT] Wrap this read in Loading` for the same read rendered with `render()` directly.
- `main.tsx:17:10 warning [NATIVE_FOREIGN_BOUNDARY] … Router (createRouter from @solidjs/router) …` (known text, F-S29).
- `SafeSessionPage.tsx` (Errored + Loading inside the page): clean.

Observation: through the route handoff the page's *pending* state is only mentioned in the related note; it is not an
error, while the same read under a direct `render()` is PENDING_ROOT. Failures are checked at both handoffs.
