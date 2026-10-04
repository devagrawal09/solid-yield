---
"@solidjs/blocks": patch
"@solidjs/eslint-plugin-blocks": minor
---

A path (a prop, a store, a row's argument, or a key of one) is a read, not an object, and now behaves as one when it is used as an object. In development, listing its keys (a spread, `Object.keys`, a `for…in`), asking for a property descriptor, or defining or deleting a key throws `[PATH_OBJECT]`. Before, these saw the proxy's own target (`root`, `getter`, `path`) or nothing, and no data. Production shows no keys and refuses the change. A path that is printed or coerced (`String(path)`, a template literal, `JSON.stringify`, Node's `util.inspect`) now describes itself, for example `[path .user.name]` or `[path .items[0]]`. Before, coercion threw `Cannot convert object to primitive value`, because `toString` resolved to another path. The cost is that a data key named `toString` or `toJSON` cannot be read through a path, as `then` already could not.

`@solidjs/eslint-plugin-blocks`: new `no-path-object-use` (in `recommended`) reports a spread of a path, `===` / `!==` / `==` / `!=` on one, and `JSON.stringify` of one, and suggests `yield* path`. It recognizes paths syntactically: a setup's `props.x…` (the props object itself may be spread), a `$store` / `$optimisticStore` / `$projection` binding or a key of one, and a row's argument. Row recognition from `no-read-in-view-body` is narrowed: a generator bound to a `const` in a setup counts as a row only when it returns a `function*`, its view, so a generator helper such as `function* matches(route)` is not a row. No twin had a site.
