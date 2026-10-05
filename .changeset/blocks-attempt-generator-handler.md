---
"solid-blocks": minor
---

An `attempt`'s handler may be a generator (D-078, amending D-076): `attempt(load, function* (e) { … })` runs it as the host's own block code, so an `$event`'s handler may write (inside the event's transaction) and wait, a `$memo`'s may read, raise and retry with a nested `attempt`; its ops and colors join the host's, and `yield* raise(e)` in it fails the attempt. Its return decides, as a plain handler's does: an `Error` with a literal `kind` fails the attempt; nothing absorbs the failure (`undefined`); a value absorbs it and is the attempt's value (`T | V`) — a value is no longer a type error. A handler returning an `Error` on one path and not on another stays `[ATTEMPT_ABSORBS]`. `until`'s handler follows the same rule.
