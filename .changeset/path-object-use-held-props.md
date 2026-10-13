---
"eslint-plugin-solid-yield": patch
---

`no-path-object-use` follows D-118 (props are given as they are): a props key is reported only when its type is a path (with type information), so a held constant or bag may be compared, spread and stringified; without type information a props key is not reported. The messages of `no-read-in-prop` and the route hooks name the held reading.
