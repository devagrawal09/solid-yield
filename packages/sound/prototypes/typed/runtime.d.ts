// Virtual declarations only. TypeScript resolves context/prop references at
// providers/callers and applies the boundary stack at each read.
type Fn = (...args: never[]) => unknown;
type Mode = "view" | "setup" | "handler" | "effect" | "lookup";
type Color<D extends readonly unknown[], E, P extends boolean, R extends boolean = true, W extends string = never> = { readonly __color: [D, E, P, R, W] };
export interface Src<T, D extends readonly unknown[] = [], E = never, P extends boolean = false> extends Color<D, E, P> { (): T }
export type Safe<T> = T & Color<[], never, false, false>;
export interface View<Q = never> { readonly __view: Q }
export interface Fails<E> { readonly __fails: E }
export declare function fails<E = never>(): Fails<E>;
interface Read<S, M extends Mode, I extends string, L extends boolean = false, B extends boolean = false> { source: S; mode: M; site: I; loading: L; errored: B }
interface Context<K extends string, T, D> { readonly __context: [K, T, D] }
interface Ref<C, P extends readonly string[], I extends string> { readonly __ref: [C, P, I] }
interface PropValue<S> { readonly __propValue: S }
interface PropRef<K extends string, N extends string> { readonly __prop: [K, N] }
interface Taint<S> { readonly __taint: S }
interface Tainted<S> { readonly __tainted: S }
interface TaintedValue<V> { readonly __taintedValue: V }
export declare function taint<S>(source: S): View<Taint<S>>;
export declare function tainted<S>(source: S): Tainted<S>;
export declare function taintedValue<V>(value: V): TaintedValue<V>;
interface Lookup<C> { readonly __lookup: C }
type Look<C, T, P extends readonly string[], I extends string> =
  T extends Fn
    ? T & Ref<C, P, I>
    : T extends object
    ? { [K in keyof T]: Look<C, T[K], [...P, K & string], I> } & Ref<C, P, I>
    : T;
export declare function context<K extends string, T = never>(): <D = undefined>(value?: D) => Context<K, [T] extends [never] ? D : T, D>;
export declare function lookup<C extends Context<string, unknown, unknown>, I extends string>(context: C, site: I): C extends Context<string, infer T, unknown> ? Look<C, T, [], I> : never;
export declare function lookupView<C, I extends string>(context: C, site: I): View<Read<Lookup<C>, "lookup", I>>;
export declare function propRef<K extends string, N extends string>(): PropRef<K, N>;
interface Caught<S> { readonly __caught: S }
export declare function caught<S>(source: S): Caught<S>;
interface At<S, I extends string> { readonly __at: [S, I] }
export declare function at<S, I extends string>(source: S, site: I): At<S, I>;
interface Missing<I extends string> { readonly __missing: I }
type Member<V, P extends readonly string[]> =
  V extends TaintedValue<infer U>
    ? Tainted<Member<U, P>>
    : P extends readonly [infer K extends string, ...infer R extends string[]]
    ? K extends keyof NonNullable<V>
    ? Member<NonNullable<V>[K], R>
    : never
    : V;
type Replace<S, K extends string, V> =
  S extends Tainted<infer U>
    ? Tainted<Replace<U, K, V>>
    : S extends PropValue<infer U>
    ? PropValue<Replace<U, K, V>>
    : S extends Ref<infer C, infer P, infer I>
    ? C extends Context<K, unknown, unknown>
    ? Member<V, P>
    : S
    : S extends Lookup<infer C>
    ? C extends Context<K, unknown, unknown>
    ? never
    : S
    : S extends Caught<infer U>
    ? Caught<Replace<U, K, V>>
    : S extends At<infer U, infer I>
    ? At<Replace<U, K, V>, I>
    : S extends Color<infer D, infer E, infer A, infer R, infer W>
    ? Color<{ [N in keyof D]: Replace<D[N], K, V> }, E, A, R, W>
    : S;
type MatchingTaint<Q, K extends string> = Q extends Taint<infer S> ? S extends Ref<Context<K, unknown, unknown>, readonly string[], string> ? true : false : false;
type ProviderValue<Q, K extends string, V> = true extends MatchingTaint<Q, K> ? TaintedValue<V> : V;
type Provide<Q, K extends string, V> =
  Q extends Taint<infer S>
    ? S extends Ref<Context<K, unknown, unknown>, readonly string[], string>
    ? never
    : Q
    : Q extends Recursive<infer C, infer P, infer I, infer O>
    ? Recursive<C, P, I, [...O, ["provide", K, V]]>
    : Q extends Read<infer S, infer M, infer I, infer L, infer B>
    ? Read<Replace<S, K, V>, M, I, L, B>
    : never;
type Default<S> =
  S extends Tainted<infer U>
    ? Tainted<Default<U>>
    : S extends PropValue<infer U>
    ? PropValue<Default<U>>
    : S extends Ref<infer C, infer P, infer I>
    ? C extends Context<string, unknown, infer D>
    ? [D] extends [undefined]
    ? Missing<I>
    : Member<D, P>
    : never
    : S extends Lookup<infer C>
    ? C extends Context<string, unknown, infer D>
    ? [D] extends [undefined]
    ? Missing<never>
    : never
    : never
    : S extends Caught<infer U>
    ? Caught<Default<U>>
    : S extends At<infer U, infer I>
    ? At<Default<U>, I>
    : S extends Color<infer D, infer E, infer A, infer R, infer W>
    ? Color<{ [N in keyof D]: Default<D[N]> }, E, A, R, W>
    : S;
// Recursive component calls are deferred references, not implicit-any views.
export interface Components {}
interface Recursive<K extends string, P, I extends string, O extends readonly unknown[] = []> { readonly __recursive: [K, P, I, O] }
export declare function recur<K extends string>(): <P, C extends readonly unknown[], I extends string>(props: P, children: C, site: I) => View<Recursive<K, P, I> | Qs<C>>;
type QOf<V> = V extends View<infer Q> ? Q : never;
type Qs<V extends readonly unknown[]> = QOf<V[number]>;
type Reads<D extends readonly unknown[], M extends Mode, I extends string> = D[number] extends infer S ? [S] extends [never] ? never : Read<S, M, I> : never;
type Facts<D extends readonly unknown[], E, M extends Mode, I extends string> = Reads<D, M, I> | ([E] extends [never] ? never : Read<Color<[], E, false, false>, M, I>);
export declare function provide<C extends Context<string, unknown, unknown>, V, A extends readonly unknown[]>(context: C, value: V, children: A): View<C extends Context<infer K, unknown, unknown> ? Provide<Qs<A>, K, ProviderValue<Qs<A>, K, V>> | (V extends { readonly __setup: infer S } ? QOf<S> : never) : never>;
export declare function functionValue<A extends unknown[]>(): <R>(fn: (...args: A) => R) => (...args: A) => R;
export declare function signal<T>(value?: T, options?: unknown): [Src<T>, (value: unknown) => void];
type Settle<T> = T extends PromiseLike<infer U> ? U : T;
type Async<T> = [T] extends [never] ? false : T extends PromiseLike<unknown> ? true : false;
export declare function memo<T, D extends readonly unknown[], E>(compute: () => T, deps: D, fails: Fails<E>): Src<Settle<T>, D, E, Async<T>>;
export declare function worst<T>(value: T): T & Color<[], unknown, true>;
export declare function worstDep(): Color<[], unknown, true>;
export declare function service<T, Q extends readonly unknown[]>(value: T, setup: Q): T & { readonly __setup: View<Qs<Q>> };
export declare function factoryView<T>(value: T): T extends { readonly __setup: infer V } ? V : View;
export declare function method<F, D extends readonly unknown[], E, W extends string = never>(fn: F, deps: D, fails: Fails<E>, writes?: W): F & Color<D, E, false, false, W>;
export declare function scope<D extends readonly unknown[], E, M extends Mode, I extends string>(deps: D, fails: Fails<E>, mode: M, site: I): View<Facts<D, E, M, I>>;
export declare function track<D extends readonly unknown[], E = never, I extends string = string, FI extends string = I>(compute: () => unknown, deps: D, fails?: Fails<E>, site?: I, failSite?: FI): View<Reads<D, "view", I> | ([E] extends [never] ? never : Read<Color<[], E, false, false>, "view", FI>)>;
export declare function host<A extends readonly unknown[], C extends readonly unknown[]>(tag: string, attrs: A, children: C): View<Qs<A> | Qs<C>>;
export declare function views<C extends readonly unknown[]>(children: C): View<Qs<C>>;
export declare function own<C extends readonly unknown[]>(children: C): View<Qs<C>>;
interface Prop<T, D extends readonly unknown[], E> { readonly __value: T; readonly __color: [D, E, false, false, never] }
export declare function prop<T, D extends readonly unknown[], E>(value: () => T, deps: D, fails: Fails<E>): Prop<T, D, E>;
type ResolveProp<S, K extends string, P> =
  S extends Tainted<infer U>
    ? Tainted<ResolveProp<U, K, P>>
    : S extends PropValue<infer U>
    ? PropValue<ResolveProp<U, K, P>>
    : S extends At<infer U, infer I>
    ? At<ResolveProp<U, K, P>, I>
    : S extends Caught<infer U>
    ? Caught<ResolveProp<U, K, P>>
    : S extends Ref<unknown, readonly string[], string>
    ? S
    : S extends PropRef<K, infer N>
    ? N extends keyof P
    ? PropValue<P[N]>
    : never
    : S extends Color<infer D, infer E, infer A, infer R, infer W>
    ? Color<{ [N in keyof D]: ResolveProp<D[N], K, P> }, E, A, R, W>
    : S;
type Call<Q, K extends string, P> =
  Q extends Taint<unknown>
    ? Q
    : Q extends Recursive<infer C, infer A, infer I, infer O>
    ? Recursive<C, A, I, [...O, ["call", K, P]]>
    : Q extends Read<infer S, infer M, infer I, infer L, infer B>
    ? Read<ResolveProp<S, K, P>, M, I, L, B>
    : never;
export declare function el<F extends Fn, P, C extends readonly unknown[], K extends string>(component: F, props: P, children: C, key?: K): View<Call<QOf<ReturnType<F>>, K, P> | Qs<C>>;
export declare function propView<D extends readonly unknown[], E>(deps: D, fails: Fails<E>): View<Facts<D, E, "view", string>>;
type Cover<Q, L extends boolean, B extends boolean> =
  Q extends Taint<unknown>
    ? Q
    : Q extends Recursive<infer K, infer P, infer I, infer O>
    ? Recursive<K, P, I, [...O, ["cover", L, B]]>
    : Q extends Read<infer S, infer M, infer I, infer A, infer E>
    ? Read<S, M, I, M extends "view"
    ? true extends L | A
    ? true
    : false
    : A, M extends "view"
    ? true extends B | E
    ? true
    : false
    : E>
    : never;
export declare function loading<F, C extends readonly unknown[]>(fallback: F, children: C): View<QOf<F> | Cover<Qs<C>, true, false>>;
export declare function errored<F, C extends readonly unknown[]>(fallback: F, children: C): View<QOf<F> | Cover<Qs<C>, false, true>>;
export declare function flow<W extends readonly unknown[], C extends readonly unknown[], K extends readonly unknown[]>(control: string, when: W, children: C, callbacks: K): View<Qs<W> | Qs<C> | Qs<K>>;
export declare function callbackView<F>(fn: F): F extends Fn ? ReturnType<F> : never;
export declare function jsxChildren(): never;
export declare function acc<T>(value: T): T;
export declare function handler<F, E, D extends readonly unknown[] = [], I extends string = string>(fn: F, fails: Fails<E>, deps?: D, site?: I): View<Facts<D, E, "handler", I>>;
export declare function checked<F, E>(fn: F, fails: Fails<E> & ([E] extends [never] ? unknown : { __UNHANDLED_HANDLER_FAILURE__: never })): F;
export declare function effect<DC extends readonly unknown[], DF extends readonly unknown[], E, I extends string = string>(compute: () => unknown, computeDeps: DC, fn: Fn, fnDeps: DF, fails: Fails<E>, site?: I): View<Facts<DC, E, "view", I> | Facts<DF, never, "effect", I>>;
export declare function setupFails<E>(fails: Fails<E> & ([E] extends [never] ? unknown : { __SETUP_MAY_THROW__: never })): void;
type Finding<C extends string, I extends string> = { code: C; site: I };
type Issue<P extends boolean, E, R extends boolean, W extends string, M extends Mode, I extends string, L extends boolean, B extends boolean> =
  (P extends true ? M extends "view" ? L extends true ? never : Finding<"ASYNC_OUTSIDE_LOADING_BOUNDARY", I> : M extends "setup" ? Finding<"PENDING_ASYNC_UNTRACKED_READ", I> : M extends "handler" ? Finding<"PENDING_ASYNC_IN_HANDLER", I> : M extends "effect" ? Finding<"PENDING_ASYNC_FORBIDDEN_SCOPE", I> : never : M extends "setup" ? R extends true ? Finding<"STRICT_READ_UNTRACKED", I> : never : never) |
  ([E] extends [never] ? never : M extends "view" ? B extends true ? never : Finding<"ERROR_OUTSIDE_ERRORED_BOUNDARY", I> : M extends "handler" ? Finding<"UNHANDLED_HANDLER_FAILURE", I> : M extends "setup" ? Finding<"SETUP_MAY_THROW", I> : never) |
  ([W] extends [never] ? never : M extends "setup" | "view" ? Finding<"REACTIVE_WRITE_IN_OWNED_SCOPE", W> : never);
// An accessor is one read, even when its computation has several dependencies.
// Collapse its palette before choosing setup's pending-versus-settled code.
type Pending<S, D extends unknown[] =
  []> = D["length"] extends 16
    ? true
    : S extends Tainted<infer U>
    ? U extends Missing<string>
    ? false
    : true
    : S extends At<infer U, string> | Caught<infer U> | PropValue<infer U>
    ? Pending<U, [...D, 0]>
    : S extends Color<infer A, unknown, infer P, boolean, string>
    ? true extends P | Pending<A[number], [...D, 0]>
    ? true
    : false
    : false;
type Failure<S, D extends unknown[] =
  []> = D["length"] extends 16
    ? unknown
    : S extends Tainted<infer U>
    ? U extends Missing<string>
    ? never
    : unknown
    : S extends Caught<unknown>
    ? never
    : S extends At<infer U, string> | PropValue<infer U>
    ? Failure<U, [...D, 0]>
    : S extends Color<infer A, infer E, boolean, boolean, string>
    ? E | Failure<A[number], [...D, 0]>
    : S extends Fn
    ? unknown
    : never;
type Writes<S, D extends unknown[] =
  []> = D["length"] extends 16
    ? never
    : S extends At<infer U, string> | Caught<infer U> | PropValue<infer U>
    ? Writes<U, [...D, 0]>
    : S extends Color<infer A, unknown, boolean, boolean, infer W>
    ? W | Writes<A[number], [...D, 0]>
    : never;
type Reactive<S, D extends unknown[] = []> = D["length"] extends 16 ? true
  : S extends Tainted<infer U> ? U extends Missing<string> ? false : true
  : S extends At<infer U, string> | Caught<infer U> | PropValue<infer U> ? Reactive<U, [...D, 0]>
  : S extends Color<infer A, unknown, boolean, infer R, string> ? true extends R | Reactive<A[number], [...D, 0]> ? true : false
  : false;
export type Palette<S> = [Pending<S>, Failure<S>, Reactive<S>, Writes<S>];
type Limited<S, D extends unknown[] = []> = [S] extends [never] ? false
  : D["length"] extends 16 ? true
  : S extends At<infer U, string> | Caught<infer U> | PropValue<infer U> | Tainted<infer U> ? Limited<U, [...D, 0]>
  : S extends Color<infer A, unknown, boolean, boolean, string> ? true extends Limited<A[number], [...D, 0]> ? true : false
  : false;
type FixedSite<F, I extends string> = F extends Finding<infer C, string> ? Finding<C, I> : never;
type HandlerSite<F, M extends Mode, I extends string> =
  M extends "handler"
    ? F extends Finding<"UNHANDLED_HANDLER_FAILURE", string>
    ? Finding<"UNHANDLED_HANDLER_FAILURE", I>
    : F
    : F;
type Inspect<S, M extends Mode, I extends string, L extends boolean, B extends boolean, C extends boolean =
  false, Depth extends unknown[] = []> = Depth["length"] extends 16
    ? Finding<"UNANALYZED_BOUNDARY", I> | Issue<true, C extends true
    ? never
    : unknown, true, never, M, I, L, B>
    : S extends Tainted<infer U>
    ? U extends Missing<infer J>
    ? Finding<"CONTEXT_PROVIDER_MISSING", J>
    : Issue<true, C extends true
    ? never
    : unknown, true, never, M, I, L, B>
    : S extends Missing<infer U>
    ? Finding<"CONTEXT_PROVIDER_MISSING", [U] extends [never]
    ? I
    : U>
    : S extends PropValue<infer U>
    ? FixedSite<Inspect<U, M, I, L, B, C, [...Depth, 0]>, I>
    : S extends At<infer U, infer J>
    ? HandlerSite<Inspect<U, M, J, L, B, C, [...Depth, 0]>, M, I>
    : S extends Caught<infer U>
    ? Inspect<U, M, I, L, B, true, [...Depth, 0]>
    : S extends Color<infer D, infer E, infer P, infer R, infer W>
    ? R extends true
    ? Issue<true extends Pending<S>
    ? true
    : false, C extends true
    ? never
    : Failure<S>, true, Writes<S>, M, I, L, B>
    : Issue<P, C extends true
    ? never
    : E, R, W, M, I, L, B> | Inspect<D[number], M, I, L, B, C, [...Depth, 0]>
    : S extends Fn
    ? Issue<false, C extends true
    ? never
    : unknown, false, never, M, I, L, B>
    : never;
type Apply<Q, O extends readonly unknown[]> =
  O extends readonly [infer H, ...infer T]
    ? H extends ["call", infer K extends string, infer P]
    ? Apply<Call<Q, K, P>, T>
    : H extends ["provide", infer K extends string, infer V]
    ? Apply<Provide<Q, K, ProviderValue<Q, K, V>>, T>
    : H extends ["cover", infer L extends boolean, infer B extends boolean]
    ? Apply<Cover<Q, L, B>, T>
    : Apply<Q, T>
    : Q;
type ApplySource<S, O extends readonly unknown[]> =
  O extends readonly [infer H, ...infer T]
    ? H extends ["call", infer K extends string, infer P]
    ? ApplySource<ResolveProp<S, K, P>, T>
    : H extends ["provide", infer K extends string, infer V]
    ? ApplySource<Replace<S, K, V>, T>
    : ApplySource<S, T>
    : Default<S>;
type Shape<V> =
  V extends Fn | Color<readonly unknown[], unknown, boolean, boolean, string>
    ? Palette<V>
    : V extends object
    ? { [K in keyof V]: V[K] extends object
    ? Palette<V[K]>
    : false }
    : false;
type Environments<O extends readonly unknown[]> = O[number] extends infer H ? H extends ["provide", infer K, infer V] ? [K, Shape<V>] : never : never;
type Covers<O extends readonly unknown[], N extends 1 | 2> =
  true extends (O[number] extends infer H
    ? H extends ["cover", boolean, boolean]
    ? H[N]
    : false
    : false)
    ? true
    : false;
type State<K extends string, P, O extends readonly unknown[]> = [K, { [N in keyof P]: Palette<ApplySource<P[N], O>> }, Environments<O>, Covers<O, 1>, Covers<O, 2>];
type Findings<Q, Seen extends readonly unknown[] =
  [], Depth extends unknown[] = []> = Q extends Read<infer S, infer M, infer I, infer L, infer B>
    ? Inspect<Default<S>, M, I, L, B> | (true extends Limited<Default<S>> ? Finding<"UNANALYZED_BOUNDARY", I> : never)
    : Q extends Recursive<infer K, infer P, infer I, infer O>
    ? State<K, P, O> extends Seen[number]
    ? never
    : Depth["length"] extends 8
    ? Finding<"UNANALYZED_BOUNDARY", I> | Findings<Apply<Read<Color<[], unknown, true>, "view", I>, O>, Seen, Depth>
    : K extends keyof Components
    ? Components[K] extends Fn
    ? Findings<Apply<Call<QOf<ReturnType<Components[K]>>, K, P>, O>, [...Seen, State<K, P, O>], [...Depth, 0]>
    : never
    : Finding<"UNANALYZED_BOUNDARY", I>
    : never;
type Markers<F> = [F] extends [never] ? unknown : { readonly __SOUND_FINDINGS__: F };
export interface Check<F> { readonly __findings: F }
export declare function render<F extends Fn>(view: F & Markers<Findings<QOf<ReturnType<NoInfer<F>>>>>, element: unknown): Check<Findings<QOf<ReturnType<F>>>>;
export declare function renderComponent<F extends Fn>(component: F & Markers<Findings<QOf<ReturnType<NoInfer<F>>>>>, element: unknown): Check<Findings<QOf<ReturnType<F>>>>;
export declare function handoff<F extends Fn>(component: F & Markers<Findings<QOf<ReturnType<NoInfer<F>>>>>) : F & Check<Findings<QOf<ReturnType<F>>>>;
type NonView<Q> = Q extends Recursive<string, unknown, string, readonly unknown[]> ? never : Q extends Read<unknown, "view", string, boolean, boolean> ? never : Q;
type OnlyView<Q> = Q extends Recursive<string, unknown, string, readonly unknown[]> ? Q : Q extends Read<unknown, "view", string, boolean, boolean> ? Q : never;
export declare function checkComponent<F extends Fn>(component: F & Markers<Findings<NonView<QOf<ReturnType<F>>>>>): Check<Findings<NonView<QOf<ReturnType<F>>>>> & { __exported: Findings<OnlyView<QOf<ReturnType<F>>>> };
export declare function exported<V>(component: (props: never) => V): V;
