/*
 * `foreign(Comp)`: a yield component handed to foreign code (D-088). Plain
 * Solid — the router's `component`, `@solidjs/web`'s `render`, Solid's
 * `lazy` — takes a component as a value and renders it with no `yield*`, so
 * no type carries the component's colors past the handoff. Pending has a
 * place to go there (the app's `Loading`, which plain Solid uses too); a
 * failure does not. So a component handed over must handle its own
 * failures: it is `View<boolean, never>`. `foreign` checks that where the
 * handoff is written, and is the identity at run time. The lint
 * `no-unchecked-foreign-handoff` reports a handoff written without it.
 *
 * Its requirements (D-098) have nowhere to go either, unless the author
 * says which providers sit above the foreign edge (D-102): `foreign(Page, {
 * provided: [ThemeCtx] })` — typically an app-wide provider above a router
 * — takes those contexts off what `Page` requires. The claim is the
 * author's; the runtime checks it where `Page` is created (`NO_PROVIDER`
 * when no provider is there). Listing a context `Page` does not require is
 * refused (`[NOT_REQUIRED]`), so the list stays the true one.
 */
import type { PlainCall, Settle, View } from "./types.js";
import type { CONTEXT, ContextNames } from "./context.js";

/** What a component's view may fail with (`never` for a plain function's). */
type FailsOfComponent<C> = C extends (...args: any[]) => View<any, infer E, any, any> ? E : never;
/** The contexts a component's view still requires (D-098; `never` for a plain function's). */
type RequiresOfComponent<C> = C extends (...args: any[]) => infer V
  ? 0 extends 1 & V
    ? never
    : V extends View<any, any, any, infer R>
      ? R
      : never
  : never;
/**
 * The failures as TypeScript will print them: their `kind`s (D-034: every
 * failure has a literal one), since a view's failure type is often printed
 * as the alias that built it; `unknown` as itself.
 */
type FailureKinds<E> = unknown extends E
  ? unknown
  : E extends { readonly kind: infer K extends string }
    ? K
    : E;

/** What `foreign`'s `provided` lists: library contexts. */
export type AnyContext = { readonly [CONTEXT]: { readonly value: any; readonly name: string } };
/** What `C` still requires once the contexts `Provided` are above it (D-102). */
type RemainingOf<C, Provided> = Exclude<Settle<RequiresOfComponent<C>>, Provided>;
/** The contexts in `Provided` that `C` does not require (D-102). */
type UnrequiredOf<C, Provided> = Provided extends unknown
  ? [Provided] extends [Settle<RequiresOfComponent<C>>]
    ? never
    : Provided
  : never;

/**
 * `never` failures: accepted. Otherwise the refusal, written inline (not as
 * a named alias) so that TypeScript prints the message, its property's type
 * naming the failures: `{ "[FOREIGN_HANDOFF] …": NotFound | ApiError }`.
 * `Provided`: the contexts the author says are provided above the foreign
 * edge (D-102), discharged from the component's requirements.
 */
export type ForeignCheck<C, Provided = never> = ([FailsOfComponent<C>] extends [never]
  ? unknown
  : {
      readonly "[FOREIGN_HANDOFF] a yield component handed to plain Solid may fail with the failure kinds this property lists: handle them inside, or wrap it in an Errored, first": FailureKinds<
        FailsOfComponent<C>
      >;
    }) &
  ([RemainingOf<C, Provided>] extends [never]
    ? unknown
    : {
        readonly "[NO_PROVIDER] a yield component handed to plain Solid requires the contexts this property names: provide them inside it (Ctx.provide around the calls that read them), or list the ones provided above the foreign edge: foreign(Comp, { provided: [Ctx] })": ContextNames<
          RemainingOf<C, Provided>
        >;
      });

/**
 * `provided` lists only contexts the component requires (D-102): a context
 * it does not read — or reads with a default — is refused, naming it.
 */
export type ProvidedCheck<C, Provided> = [UnrequiredOf<C, Provided>] extends [never]
  ? unknown
  : {
      readonly "[NOT_REQUIRED] foreign's provided lists contexts the component does not require (this property names them): remove them": ContextNames<
        UnrequiredOf<C, Provided>
      >;
    };

/** `foreign`'s options (D-102). */
export interface ForeignOptions<P extends readonly AnyContext[]> {
  /**
   * The contexts provided above the foreign edge — e.g. an app-wide
   * `Ctx.provide` around a router whose route renders the component. They
   * are taken off the component's requirements; the runtime checks the claim
   * where the component is created (`NO_PROVIDER`).
   */
  readonly provided: P;
}

/**
 * `defineRoute({ path: "/", component: foreign(Live) })`: hand a yield
 * component to plain Solid. It may pend (under the app's `Loading`); a
 * component that may fail is a type error here (`[FOREIGN_HANDOFF]`, naming
 * its failures): handle them in it, with an `Errored` in its view, first.
 * One that requires a context is too (`[NO_PROVIDER]`), unless the context
 * is listed as provided above the edge: `foreign(Live, { provided:
 * [ThemeCtx] })` (D-102). The identity at run time.
 */
export function foreign<
  C extends (...args: any[]) => unknown,
  const P extends readonly AnyContext[] = []
>(
  component: C & ForeignCheck<C, P[number]>,
  options?: ForeignOptions<P & ProvidedCheck<C, P[number]>>
): C;
export function foreign(component: unknown, _options?: unknown): unknown {
  return component;
}

/**
 * @internal Native lowering: `foreign` for a component plain Solid code
 * wrote as a value (a route's `component`). Its type is the plain call
 * (`PlainCall`): the router passes its own props, which a component that
 * declares none ignores, as the author's plain Solid function did (F-S43).
 * The library dialect's `foreign` keeps the component's own type (D-088).
 */
export function nativeForeign<C extends (...args: any[]) => unknown>(
  component: C & ForeignCheck<C>
): PlainCall<C> {
  return component as PlainCall<C>;
}

/**
 * @internal Native lowering (F-S43): a component handed to a foreign router
 * that is rendered under the providers of `Q` wherever it appears. Those
 * contexts are taken off its requirements, as `foreign`'s `provided` does;
 * the list is the compiler's, from structure, so a context the component does
 * not read is not refused. `provided` is a type witness (`null` at run time);
 * the runtime still checks each requirement where the component is created.
 */
export function nativeForeignProvided<C extends (...args: any[]) => unknown, Q>(
  component: C & ForeignCheck<C, Q>,
  _provided: Q
): PlainCall<C> {
  return component as PlainCall<C>;
}
