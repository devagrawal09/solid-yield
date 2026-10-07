# Todos sugar prototype

Same TodoMVC behavior as todos-yield; `"use yield"` opts its three routine files into reconstruction. Run `pnpm test` for the shared parity script and behavior tests. Run `pnpm typecheck` / `pnpm lint` to generate and check `.generated/src`, not the sugar source. `pnpm generate` also asserts normalized equality with every todos-yield source module and runs the existing analyzer.

The Vite plugin reconstructs the actual `src` at build/test time. It does not read the handwritten twin. The comparison script uses that twin only as an independent oracle.

`string/` exercises SSR and hydration through the repository smoke harness, with deterministic adapters for the browser-only mock API. The hydrated event adds a todo. Ordinary editor checking of sugar is deliberately unresolved; see [the design](../../documentation/sugar-design.md).
