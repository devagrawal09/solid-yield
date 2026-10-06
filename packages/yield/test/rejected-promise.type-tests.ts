import { $event, attempt, type EventCall } from "solid-yield";
class TransportError extends Error {
  readonly kind = "transport" as const;
}
// Promise.reject infers Promise<never>. It is a wait, never a stream.
const rejectOnly = $event(function* () {
  yield* attempt(
    () => Promise.reject(new Error("down")),
    cause => new TransportError(String(cause))
  );
});
type Failure<C> = C extends (...args: any[]) => EventCall<any, infer E, any, any> ? E : never;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
// After the fix this event has the exact failure, without an any color.
type _failure = Expect<Equal<Failure<typeof rejectOnly>, TransportError>>;
