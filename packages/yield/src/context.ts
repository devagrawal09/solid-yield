/*
 * Contexts for yield components (D-036, D-060, D-098).
 *
 * `createContext<T, "Name">(undefined, { name: "Name" })` — no default, named — makes a context a
 * component *requires*: a setup that reads it (`yield* Ctx`) adds the context to its
 * component's type (`ComponentView`'s `R`, folded with `RequiresOf`), and the
 * requirement travels through calls, holes and rows like a failure, until a
 * `Ctx.provide({ value, children })` around the call discharges it.
 * `render`, `hydrate` and `foreign()` refuse a component that still requires
 * one. `createContext(defaultValue)` makes a context that is always there to
 * read: no requirement.
 *
 * A provided value is read like a prop (D-042): `yield* Ctx` gives the setup
 * a path over it, never the value, and the view's holes, a memo or an event
 * read it. `provide`'s `value` takes what a prop takes (D-065): a value, a
 * source or a hole.
 */
declare const __DEV__: boolean;

import type { Context } from "solid-js";
import { devError, readContext, solidCreateContext } from "./runtime.js";
import { provideView, type Children, type LazyParam, type Ops } from "./flow.js";
import type {
  CREATED,
  ComponentView,
  ContextRead,
  FailsOf,
  HoleProp,
  MayWaitOf,
  Path,
  PendingOf,
  RequiresOf,
  Settle,
  Source
} from "./types.js";

/** Phantom: a context's value type (invariant) and its name. */
export declare const CONTEXT: unique symbol;
/** Phantom: what a `provide` gives and discharges. */
export declare const PROVIDES: unique symbol;

/**
 * What `yield* Ctx` gives a setup: the provided value as a prop is read — a
 * path (D-042). A context of sources declares its colors as a prop does
 * (`createContext<Source<User, ApiError, true>>()` reads as a path that may
 * be pending and fail).
 */
export type ContextValue<T> = [T] extends [Source<infer V, infer E, infer P>]
  ? Path<V, E, P>
  : Path<T>;
/**
 * What `provide`'s `value` takes (D-065): a value, a source of it or a hole,
 * within its declared colors. Never `undefined` itself: Solid reads a
 * provided `undefined` as unset — its default, else no provider (calculus
 * F-3, S11). A context that may carry nothing models it inside the value:
 * `null`, or a source of `T | null`. A source or a hole is a provided
 * value whatever it reads.
 */
export type ProvidedValue<T> = [T] extends [Source<infer V, infer E, infer P>]
  ?
      | Exclude<V, undefined>
      | Source<V, E, [P] extends [true] ? boolean : P>
      | HoleProp<V, E, [P] extends [true] ? boolean : P>
      | ProvideUndefined<V>
  : Exclude<T, undefined> | Source<T> | HoleProp<T> | ProvideUndefined<T>;
/**
 * The refusal's message, when the value type admits `undefined` (TypeScript
 * prints it in the expected type). Written inline so that it is printed
 * rather than an alias's name.
 */
type ProvideUndefined<T> = undefined extends T
  ? {
      readonly "[PROVIDE_UNDEFINED] a provided undefined reads as no provider: provide null, or a source": never;
    }
  : never;

/**
 * A library context. `Q` is what a setup's read of it requires: the context
 * itself when it has no default (`RequiredContext`), else `never`.
 * Requirements are nominal, as the runtime's providers are (D-098 amended):
 * a context without a default is named, `createContext<User, "UserCtx">()`,
 * and the name brands its requirement, so two contexts of one value type are
 * two requirements and a provider discharges only its own. The value type is
 * invariant too (`[CONTEXT]`): a provider of another value type, narrower or
 * wider, discharges nothing. The root's refusal prints the name.
 */
export interface ContextOps<T, N extends string, Q> {
  readonly [CONTEXT]: { readonly value: (value: T) => T; readonly name: N };
  /** `yield* Ctx` in a setup: the value, as a path; a context without a default is required. */
  [Symbol.iterator](): Generator<ContextRead<Q>, ContextValue<T>, any>;
  /**
   * `{yield* Ctx.provide({ value, children: function* () { return <…/>; } })}`
   * (D-098): gives `value` to the components called in `children`, and
   * discharges their requirement of this context. Only theirs: the
   * enclosing component's own setup read was resolved where that component
   * was created, above this provider. In `h`: `h(Ctx.provide, { value },
   * ...children)`.
   */
  readonly provide: Provide<T, Q>;
}
/** `Ctx.provide`: a call-form yield component (D-062, D-066). */
export interface Provide<T, Q> {
  <C>(props: {
    value: ProvidedValue<T>;
    children: LazyParam<C, Children<[]>, "children">;
  }): ComponentView<
    PendingOf<Ops<C>>,
    FailsOf<Ops<C>>,
    MayWaitOf<Ops<C>>,
    Exclude<Settle<RequiresOf<Ops<C>>>, Q>
  >;
  /** Phantom: what it gives and discharges (`h`'s provider overload reads it). */
  readonly [PROVIDES]: { readonly value: T; readonly discharges: Q };
}
/** A context with a default (D-060): always there to read, so never required. */
export interface YieldContext<T, N extends string = string>
  extends Context<T>, ContextOps<T, N, never> {}
/** A context without a default (D-098): reading it requires a provider above. */
export interface RequiredContext<T, N extends string = string>
  extends Context<T>, ContextOps<T, N, RequiredContext<T, N>> {}

/**
 * What `createContext<T>()` gives without a name (D-098 amended): nothing a
 * routine can read or provide. A context without a default is a requirement,
 * and a requirement is told apart by its name, so it must have one. The
 * property's name is the message TypeScript prints where it is used.
 */
export interface UnnamedContext {
  readonly '[UNNAMED_CONTEXT] a context without a default needs a name: createContext<User, "UserCtx">()': never;
}

/** The same refusal at the call: TypeScript prints this `this` type where `createContext<User>()` is written. */
export type UnnamedContextCall =
  '[UNNAMED_CONTEXT] a context without a default needs a name: createContext<User, "UserCtx">()';

/**
 * The contexts a root still requires, as the refusal prints them: by name
 * (a context with a type-level name only, `string`, cannot be required).
 */
export type ContextNames<R> = R extends { readonly [CREATED]: infer C }
  ? ContextNames<C>
  : R extends { readonly [CONTEXT]: { readonly name: infer N } }
    ? string extends N
      ? R
      : N
    : R;

/**
 * `createContext<T, "Name">(undefined, { name: "Name" })`: a context a reader requires (D-098). The name
 * is its requirement's identity (D-098 amended: two contexts are two
 * providers, whatever their value types) and what the refusal at the root
 * prints. Without a name it is refused: the call (its `this`) and its result
 * (`UnnamedContext`) say "name the context". A provided value is read like
 * a prop.
 */
/** A required context's name must exist at runtime too: type arguments are erased. */
export function createContext<T, N extends string = string>(
  this: string extends N
    ? UnnamedContextCall
    : {
        readonly "[CONTEXT_NAME] pass the context's name at runtime: createContext<T, 'Name'>(undefined, { name: 'Name' })": never;
      }
): string extends N ? UnnamedContext : RequiredContext<T, N>;
export function createContext<T, N extends string = string>(
  this: string extends N ? UnnamedContextCall : void,
  defaultValue: undefined,
  options: { name: N }
): string extends N ? UnnamedContext : RequiredContext<T, N>;
/**
 * `createContext(defaultValue)`: a context that is always there to read
 * (D-060: `constant(value)` for a default that is a source).
 */
export function createContext<T, N extends string = string>(
  defaultValue: Exclude<T, undefined>,
  options?: { name?: N }
): YieldContext<T, N>;
export function createContext(
  this: unknown,
  defaultValue?: unknown,
  options?: { name?: string }
): unknown {
  if (__DEV__ && defaultValue === undefined && !options?.name)
    throw devError(
      "CONTEXT_NAME",
      "a context without a default needs a runtime name: createContext<T, 'Name'>(undefined, { name: 'Name' }). Type arguments disappear at runtime."
    );
  const ctx = solidCreateContext(defaultValue as any, options as any) as any;
  ctx[Symbol.iterator] = function* (this: unknown): Generator<never, unknown, unknown> {
    return readContext(ctx);
  };
  ctx.provide = (props: unknown) => provideView(ctx, props);
  return ctx;
}
