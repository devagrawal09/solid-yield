/** Type-checked witnesses. No assertion, any, or diagnostic suppression. */
import { $event, $memo, attempt, component, createContext, Errored,
  foreign, Loading, raise, render, view, type View, type KindCheck } from "solid-yield";
import { h } from "solid-yield/h";

class Boom extends Error { readonly kind = "proof-boom"; }
const fail = $event(function* () { yield* raise(Object.freeze(new Boom())); });
export const frozenAbsorbed = $event(function* () {
  yield* attempt(() => fail(), () => {});
});

const Ctx = createContext<string, "ProofCtx">();
export const Reader = component(function* () {
  const c = yield* Ctx;
  return view(function* () { return <b>{yield* c}</b>; });
});
const routed = foreign(Reader, { provided: [Ctx] });
// Foreign code loses the requirement, as a router does. The claim is false.
export function Router() { return h(routed, {}); }
// Use a plain Solid component's output type for the foreign tag (JSX is an Element).
export const ForeignRoot = component(function* () {
  return view(function* () { return <Router />; });
});

// A possibly undefined default is typed defaulted even when actually absent.
const UndefinedDefault = createContext<string | undefined>(undefined);
export const DefaultReader = component(function* () {
  const c = yield* UndefinedDefault;
  return view(function* () { return <b>{yield* c}</b>; });
});
export const defaultReaderSettled: () => View<false, never, false, never> = DefaultReader;

// An unreachable handler return still contributes a failure, with no wider annotation.
export const NeverFails = component(function* () {
  const m = yield* $memo(function* () {
    return yield* attempt(() => 1, () => new Boom());
  });
  return view(function* () { return <b>{yield* m}</b>; });
});
export const overstatement: () => View<false, Boom, false, never> = NeverFails;

// h.Fragment claims a settled result regardless of its children's colors.
export const FragmentReader = component(function* () {
  return view(function* () { return h.Fragment({ children: h(Reader, {}) }); });
});
export const fragmentSettled: () => View<false, never, false, never> = FragmentReader;

// Unique class kinds do not force prototype identity: a structural object is admitted.
const shaped: Boom = { name: "Error", message: "shaped", kind: "proof-boom" };
export const ShapeFails = component(function* () {
  const m = yield* $memo(function* () { return yield* raise(shaped); });
  return view(function* () { return <b>{yield* m}</b>; });
});
export const ShapeCaught = () => Errored({ catch: [Boom], fallback: "caught", children: ShapeFails });
export const shapeSettled: () => View<false, never, false, never> = ShapeCaught;

// Admission is a set of operations; it contains no temporal read-before-wait rule.
export const ReadAfterWait = component(function* () {
  const m = yield* $memo(function* () {
    yield* attempt(() => Promise.resolve(1), () => new Boom());
    return yield* (yieldedConstant);
  });
  return view(function* () { return <b>{yield* m}</b>; });
});
import { constant } from "solid-yield";
const yieldedConstant = constant(1);

// These are compiler probes, not mounts during module evaluation.
export function roots(el: HTMLElement) {
  render(ForeignRoot, el);
  render(DefaultReader, el);
  render(FragmentReader, el);
  render(ShapeCaught, el);
  render(() => Loading({ children: ReadAfterWait }), el);
}
// Literal kind checking only; not a proof of a constructor or prototype.
export const kindCheck: KindCheck<Boom> = {};

// HandlerCheck accepts unknown, but runtime handle() still throws an Error result.
const unknownHandler = (): unknown => new Boom("widened handler");
export const WidenedHandler = component(function* () {
  const m = yield* $memo(function* () {
    return yield* attempt(() => BigInt("invalid"), unknownHandler);
  });
  return view(function* () { return <b>{String(yield* m)}</b>; });
});
export const widenedSettled: () => View<false, never, false, never> = WidenedHandler;


import { $effect, type Props } from "solid-yield";
const ReadsUnknown = component(function* (props: Props<{ value: unknown }>) {
  return view(function* () { return <b>{String(yield* props.value)}</b>; });
});
export const UnknownProp = component(function* () {
  const bad = yield* $memo(function* () { return yield* raise(new Boom("unknown prop")); });
  return view(function* () { return <>{yield* ReadsUnknown({ value: bad })}</>; });
});
export const unknownPropSettled: () => View<false, never, false, never> = UnknownProp;

const EffectFails = component(function* () {
  yield* $effect(function* () {}, function* () { yield* raise(new Boom("eager effect")); });
  return view(function* () { return <b>child</b>; });
});
export const EagerEffect = component(function* () {
  return view(function* () { return h(Errored, { fallback: "caught" }, EffectFails()); });
});
export const eagerSettled: () => View<false, never, false, never> = EagerEffect;

// Exclude<unknown, undefined> is still unknown, so the F-3 guard has a hole.
const UnknownCtx = createContext<unknown, "ProofUnknownCtx">();
const UnknownReader = component(function* () {
  const c = yield* UnknownCtx;
  return view(function* () { return <b>{String(yield* c)}</b>; });
});
export const UndefinedProvided = () => UnknownCtx.provide({ value: undefined, children: UnknownReader });
export const undefinedProvidedSettled: () => View<false, never, false, never> = UndefinedProvided;

import { type Source } from "solid-yield";
import { For as SolidFor, type Element as SolidElement } from "solid-js";
function ForeignRows(props: { children?: (item: number) => SolidElement }) {
  const row = props.children;
  return row ? SolidFor({ each: [1], children: row }) : null;
}
// GeneratorOps' row-return branch omits its setup Y.
export const HRowLoss = component(function* () {
  return view(function* () {
    return h(ForeignRows, {}, function* (_item: Source<number>) {
      const c = yield* Ctx;
      return view(function* () { return h("b", c); });
    });
  });
});
export const hRowSettled: () => View<false, never, false, never> = HRowLoss;

const PendingForeign = component(function* () {
  const m = yield* $memo(function* () {
    return yield* attempt(() => new Promise<string>(() => {}), () => "fallback");
  });
  return view(function* () { return <b>{yield* m}</b>; });
});
const pendingRoute = foreign(PendingForeign);
function PendingRouter() { return h(pendingRoute, {}); }
export const ForeignPendingRoot = component(function* () {
  return view(function* () { return <PendingRouter />; });
});
export const foreignPendingSettled: () => View<false, never, false, never> = ForeignPendingRoot;
