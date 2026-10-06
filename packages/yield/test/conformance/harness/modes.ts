/**
 * The mode registry. Adding a mode is adding an adapter here (see
 * ../README.md, "Adding a mode"); scenarios and specs pick it up by
 * environment.
 *
 * The fork's harness ran a `$` runtime driver, compiler-lowered and
 * host-fused `$` modes and two yield-component modes (`yield-compiled`, the
 * yield compiler; `yield-uncompiled`, a generic JSX transform). This
 * repository has the library route only: `library` modes run the library
 * dialect through `vite-plugin-solid-yield` and the published Solid
 * compiler on the library's runtime. The compiler route's server output is
 * kept, frozen, under `__artifacts__/compiler-route/` and compared in
 * `routes.spec.ts`.
 */
import type { Environment, ModeAdapter, ModeId } from "./types.js";

export const modes: ModeAdapter[] = [
  // --- client: fresh render in jsdom ------------------------------------------
  {
    id: "client/reference",
    title: "handwritten Solid",
    environment: "client",
    source: "reference",
    compile: { generate: "dom" }
  },
  {
    id: "client/library",
    title: "solid-yield: the yield rule, the Solid compiler, the library's runtime",
    environment: "client",
    source: "library",
    compile: { generate: "dom" },
    reference: "client/reference"
  },
  // --- server: SSR -------------------------------------------------------------
  {
    id: "server/reference",
    title: "handwritten Solid, SSR",
    environment: "server",
    source: "reference",
    compile: { generate: "ssr", hydratable: true }
  },
  {
    id: "server/library",
    title: "solid-yield, SSR",
    environment: "server",
    source: "library",
    compile: { generate: "ssr", hydratable: true },
    reference: "server/reference"
  },
  // --- hydrate: client hydrating the matching server mode's markup -------------
  {
    id: "hydrate/reference",
    title: "handwritten Solid, hydration",
    environment: "hydrate",
    source: "reference",
    compile: { generate: "dom", hydratable: true },
    pairedWith: "server/reference"
  },
  {
    id: "hydrate/library",
    title: "solid-yield, hydration",
    environment: "hydrate",
    source: "library",
    compile: { generate: "dom", hydratable: true },
    reference: "hydrate/reference",
    pairedWith: "server/library"
  }
];

/**
 * Modes of the fork's harness this repository cannot run. They appear in the
 * coverage matrix so the gap is explicit.
 */
export const absentModes: { id: ModeId; title: string; why: string }[] = [
  {
    id: "*/compiled, */fused, */runtime",
    title: "the `$`-block proposal's driver, lowering and host fusion",
    why: "the `$` dialect is not this library's (D-013); those scenarios stayed in the fork"
  },
  {
    id: "*/yield-compiled",
    title: "yield components through a yield compiler",
    why: "no yield compiler here (D-043); its server output is kept as `__artifacts__/compiler-route/` and compared with the library route in routes.spec.ts"
  },
  {
    id: "client/yield-uncompiled",
    title: "yield components with a generic JSX transform",
    why: "superseded: the library route runs the yield rule, so every JSX hole is its own computation (D-003)"
  },
  {
    id: "islands, tiers",
    title: "island activation and runtime tiers (islands.spec.ts, tiers.spec.ts)",
    why: "compiler features the library does not have (yield-library.md §7: no islands, no runtime tiers)"
  }
];

export function modesFor(environment: Environment): ModeAdapter[] {
  return modes.filter(mode => mode.environment === environment);
}

export function mode(id: ModeId): ModeAdapter {
  const found = modes.find(m => m.id === id);
  if (!found) throw new Error(`[conformance] unknown mode ${id}`);
  return found;
}
