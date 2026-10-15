import { Failure, attempt, $event, raise, type FailsOf, type Yieldable } from "solid-yield";
class Base extends Failure("base") {}
class Sub extends Base {}
class Sibling extends Failure("sibling") {}
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
const source = $event(function* (which: boolean) {
  return yield* raise(which ? new Sub() : new Sibling());
});
const selective = attempt(
  () => source(true),
  e => {
    const base: Base = e;
    void base;
  },
  { catch: [Base] }
);
type Ops<T> = T extends Yieldable<infer Y, any> ? Y : never;
export type ResidualSibling = Expect<Equal<FailsOf<Ops<typeof selective>>, Sibling>>;
const allSub = $event(function* () {
  return yield* raise(new Sub());
});
const discharged = attempt(
  () => allSub(),
  () => {},
  { catch: [Base] }
);
export type DischargedSubclass = Expect<Equal<FailsOf<Ops<typeof discharged>>, never>>;
const opaque = attempt(
  () => Promise.reject(new Sub()),
  () => {},
  { catch: [Base] }
);
export type UnknownRetained = Expect<Equal<FailsOf<Ops<typeof opaque>>, unknown>>;
