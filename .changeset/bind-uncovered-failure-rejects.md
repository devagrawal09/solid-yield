---
"solid-yield": patch
---

An `$event` bound under an `Errored` whose `catch` does not list its failure, with no `Errored` above that takes it, now rejects the call (D-085), as with no `Errored` at all. It was reported to the boundary anyway, re-thrown out of Solid's flush, and halted the reactive system (`[REACTIVITY_HALTED]`, development and production). The bind site now asks the chain of `Errored`s above it whether one takes the failure (an `instanceof` match against its `catch`, or no `catch`) before reporting it (calculus §6.3 F-7).
