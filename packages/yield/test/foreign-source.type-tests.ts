import { attempt, foreignSource, type FailsOf, type PendingOf, type Source } from "solid-yield";
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
class ForeignError extends Error {
  readonly kind = "foreign" as const;
}
const source = foreignSource(() => 1);
type _Source = Expect<Equal<typeof source, Source<number, unknown, boolean>>>;
const read = attempt(
  () => source,
  cause => new ForeignError(String(cause))
);
type Ops =
  ReturnType<(typeof read)[typeof Symbol.iterator]> extends Generator<infer Y, any, any>
    ? Y
    : never;
type _Failure = Expect<Equal<FailsOf<Ops>, ForeignError>>;
type _Pending = Expect<Equal<PendingOf<Ops>, true>>;
attempt(
  () => source,
  // @ts-expect-error Q5 requires a kind, not an untyped Error.
  cause => new Error(String(cause))
);
attempt(
  () => source,
  // @ts-expect-error Q5 requires a named failure, not absorption.
  () => undefined
);
// @ts-expect-error unknown failures cannot be silently declared settled.
const settled: Source<number> = source;
void settled;
