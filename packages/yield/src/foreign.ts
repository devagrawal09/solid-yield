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
 */
import type { View } from "./types.js";

/** What a component's view may fail with (`never` for a plain function's). */
type FailsOfComponent<C> = C extends (...args: any[]) => View<any, infer E, any> ? E : never;
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

/**
 * `never` failures: accepted. Otherwise the refusal, written inline (not as
 * a named alias) so that TypeScript prints the message, its property's type
 * naming the failures: `{ "[FOREIGN_HANDOFF] …": NotFound | ApiError }`.
 */
export type ForeignCheck<C> = [FailsOfComponent<C>] extends [never]
  ? unknown
  : {
      readonly "[FOREIGN_HANDOFF] a yield component handed to plain Solid may fail with the failure kinds this property lists: handle them inside, or wrap it in an Errored, first": FailureKinds<
        FailsOfComponent<C>
      >;
    };

/**
 * `defineRoute({ path: "/", component: foreign(Live) })`: hand a yield
 * component to plain Solid. It may pend (under the app's `Loading`); a
 * component that may fail is a type error here (`[FOREIGN_HANDOFF]`, naming
 * its failures): handle them in it, with an `Errored` in its view, first.
 * The identity at run time.
 */
export function foreign<C extends (...args: any[]) => unknown>(component: C & ForeignCheck<C>): C {
  return component;
}
