---
"solid-blocks": patch
---

`$optimistic` is the scalar form and `$optimisticStore` the object-or-body form, as `$signal` and `$store` are (D-014). Neither had a second spelling: `$optimistic` has only ever taken a value (`Exclude<T, Function>`), and a derived optimistic value is `$optimisticStore(function* (draft) { … }, seed)`. Solid's own primitives still take both, though. `createOptimistic(fn)` derives from a function, and `createOptimisticStore` accepts a scalar. Code that reached either form through a cast or plain JavaScript therefore got Solid's other behaviour silently. Development builds now refuse both with `[OPTIMISTIC_FORM]`, naming the other form: a function given to `$optimistic`, or a value given to `$optimisticStore` that is neither an object nor a body. The two forms are pinned by type tests and a runtime test.
