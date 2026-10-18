/** Facade for props supplied by a plain Solid owner (C).
 * Values have no library colors; the component's own failures are retained. */
import { READ, REFS, rowArg } from "./runtime.js";
import type { Path, Source, DECLARED, PROPS, HOLE_REQUIRES } from "./types.js";
const protocolKeys = [
  READ,
  REFS,
  Symbol.iterator,
  Symbol.asyncIterator,
  Symbol.toStringTag,
  Symbol.toPrimitive
] as const;
type ProtocolKey = (typeof protocolKeys)[number];
const protocolKeySet = new Set<PropertyKey>(protocolKeys);
declare const NATIVE_PROPS: unique symbol;
type NativeDeclared<D> = { [K in keyof D]: K extends ProtocolKey ? D[K] : Source<D[K]> } & {
  readonly [NATIVE_PROPS]?: Source<D>;
};
export type NativeProps<D> = Readonly<Pick<D, Extract<keyof D, ProtocolKey>>> & {
  readonly [K in Exclude<keyof D, ProtocolKey>]: K extends "children" ? Source<D[K]> : Path<D[K]>;
} & { readonly [PROPS]?: (props: NativeDeclared<D>) => NativeDeclared<D> };
type NativeInput<C> = C extends { readonly [DECLARED]?: (props: infer D) => unknown }
  ? D extends { readonly [NATIVE_PROPS]?: Source<infer P> }
    ? P
    : never
  : never;
export function nativeC<C extends (...props: any[]) => unknown>(
  routine: C
): (props: NativeInput<C>) => ReturnType<C>;
export function nativeC(routine: (...props: any[]) => unknown): unknown {
  return new Proxy(routine, {
    apply(fn, self, args) {
      const raw = args[0] ?? {};
      // Foreign props are paths even when Solid supplies a held bag or omits a key.
      // An empty target also permits adapting frozen, non-configurable properties.
      const props = new Proxy(
        {},
        {
          get(_target, key) {
            return protocolKeySet.has(key)
              ? Reflect.get(raw, key)
              : rowArg(() => Reflect.get(raw, key), true);
          },
          has(_target, key) {
            return key in raw;
          },
          ownKeys() {
            return Reflect.ownKeys(raw);
          },
          // Virtual keys require an extensible target; reject sealing without changing it.
          preventExtensions() {
            return false;
          },
          getOwnPropertyDescriptor(_target, key) {
            const descriptor = Reflect.getOwnPropertyDescriptor(raw, key);
            if (!descriptor) return undefined;
            return protocolKeySet.has(key)
              ? { ...descriptor, configurable: true }
              : {
                  configurable: true,
                  enumerable: descriptor.enumerable,
                  value: rowArg(() => Reflect.get(raw, key), true)
                };
          }
        }
      );
      return Reflect.apply(fn, self, [props, ...args.slice(1)]);
    }
  });
}
/** F-S49: what a generated generic component's hole props may require, a
 * type parameter of its setup that each call infers from its holes and
 * carries (`HoleQ`). The lowering adds it where it makes a component generic. */
export type NativeRequiring<Q> = { readonly [HOLE_REQUIRES]?: (q: Q) => Q };
