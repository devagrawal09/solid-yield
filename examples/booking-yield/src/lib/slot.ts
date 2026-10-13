// A state slot, as a convention: a context whose value is a slice. Required, or standalone with a sentinel default.
import {
  $event,
  $store,
  createContext,
  type ContextRead,
  type Create,
  type RequiredContext,
  type YieldContext
} from "solid-yield";
import type { Slice } from "./lens";

const NONE = Symbol("no provider");
/** A slot a module reads only under a provider: it joins the module's requirements (`R`). */
export type RequiredSlot<S, N extends string> = RequiredContext<Slice<S>, N>;
/** A slot a module may read alone: no provider is `NONE`, and the module makes its own slice. */
export type StandaloneSlot<S, N extends string> = YieldContext<Slice<S> | typeof NONE, N> & {
  readonly init: () => S;
};

export function createSlot<S, N extends string>(options: { name: N }): RequiredSlot<S, N>;
export function createSlot<S, N extends string>(options: {
  name: N;
  init: () => S;
}): StandaloneSlot<S, N>;
export function createSlot(options: { name: string; init?: () => unknown }): unknown {
  if (!options.init)
    return createContext<Slice<unknown>, "slot">(undefined, { name: options.name as "slot" });
  return Object.assign(createContext<unknown>(NONE, { name: options.name }), {
    init: options.init
  });
}

/** `const range = yield* slot(RangeSlot)` in a setup: the provider's slice, else (standalone) the module's own. */
export function slot<S, N extends string>(
  of: RequiredSlot<S, N>
): Generator<ContextRead<RequiredSlot<S, N>>, Slice<S>, unknown>;
export function slot<S, N extends string>(
  of: StandaloneSlot<S, N>
): Generator<ContextRead | Create<"store">, Slice<S>, unknown>;
export function* slot<S>(of: RequiredSlot<S, string> | StandaloneSlot<S, string>) {
  const provided: Slice<S> | typeof NONE = yield* of;
  if (provided !== NONE) return provided;
  const [at, setAt] = yield* $store((of as StandaloneSlot<S, string>).init() as S & object);
  const set = $event(function* (write: (draft: S) => void) {
    yield* setAt(draft => {
      write(draft as S);
    });
  });
  return { at, set } as Slice<S>;
}
