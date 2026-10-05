---
"vite-plugin-solid-blocks": patch
---

The fast skip no longer passes over generator methods. It looked for the text `function*`, so a JSX hole in `function *View()`, an object or class `*view()`, an `async *gen()` or a `static *view()` reached the JSX compiler untransformed. A module is now a candidate when its source contains `yield` at all (the transform's own pre-check), and the parse decides: a `yield` only in a string or a comment costs a parse and changes nothing.
