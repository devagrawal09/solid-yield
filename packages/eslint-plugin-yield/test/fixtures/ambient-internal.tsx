declare module "solid-yield/internal" {
  export function nativeForeign<C>(c: C): C;
  export function nativeForeignProvided<C>(c: C, ...rest: unknown[]): C;
  export function nativeOther<C>(c: C): C;
}
