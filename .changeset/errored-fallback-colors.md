---
"solid-yield": patch
---

`Errored`'s call form carries every fallback's colors (D-071): a render function `(error, reset) => …`'s output and `h` output now add their pending reads, failures, may-wait marker and requirements to the boundary's view, as a lazy view's and a row's did and as `h(Errored, …)` always has. At run time such a fallback is rendered outside its own boundary's handling, so what it reads pending and how it fails reach the boundaries above; the types dropped them (calculus §6.3 F-1).
