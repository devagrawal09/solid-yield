// Prototype A's virtual declaration module ("solid-sound-typed"). It is never
// shipped: the transform (transform.mjs) rewrites the user's plain Solid into
// calls of these functions, in memory, so that TypeScript's type system folds
// the reactive facts — pending (P), failures (E), reactivity — over
// syntactically extracted dependency lists and the JSX tree, and surfaces the
// obligations as ordinary type errors carrying a __MARKER__ name that the
// classifier maps to a solid-sound code.

// ---- facts ------------------------------------------------------------------
/** A reactive accessor with phantom colors: P pending, E failures. */
export interface Src<T, P extends boolean = false, E = never> {
  (): T;
  readonly __src: [P, E];
}
/** A value from an unanalyzed construct: reactive, possibly pending, failing with unknown. Its members and
 * call results are `any` so the user's code keeps type-checking; the colors live on the root identifier,
 * which is what the dependency lists name (a member stored in its own variable loses them: a known gap). */
export interface Worst {
  readonly __src: [true, unknown];
  readonly __worst: true;
  readonly [key: string]: any;
  (...args: any[]): any;
  [Symbol.iterator](): Iterator<Worst>;
}
/** A rendered view and the obligations it still carries. */
export interface View<P extends boolean = false, E = never> {
  readonly __view: [P, E];
}
export type AnyView = View<boolean, unknown>;

type IsAny<T> = 0 extends 1 & T ? true : false;
/** The pending color of one dependency. */
type PendingOf1<D> = IsAny<D> extends true ? false : D extends Worst ? true : D extends Src<unknown, infer P, unknown> ? P : D extends View<infer P, unknown> ? P : false;
/** The failure color of one dependency. */
type FailsOf1<D> = IsAny<D> extends true ? never : D extends Worst ? unknown : D extends Src<unknown, boolean, infer E> ? E : D extends View<boolean, infer E> ? E : never;
/** Fold over a tuple / array of dependencies or children. */
export type PendingOf<D extends readonly unknown[]> = true extends PendingOf1<D[number]> ? true : false;
export type FailsOf<D extends readonly unknown[]> = FailsOf1<D[number]>;
type IsPromise<T> = IsAny<T> extends true ? false : [T] extends [never] ? false : [T] extends [PromiseLike<unknown>] ? true : false;
type Settle<T> = T extends PromiseLike<infer U> ? U : T;
/** A failure set the transform's pre-pass computed, carried as a type (never = none). */
export interface Fails<E> { readonly __fails: E }
export declare function fails<E = never>(): Fails<E>;

// ---- markers: each intended error names its code ------------------------------
export interface __STRICT_READ_UNTRACKED__ { readonly __STRICT_READ_UNTRACKED__: never }
export interface __PENDING_ASYNC_UNTRACKED_READ__ { readonly __PENDING_ASYNC_UNTRACKED_READ__: never }
export interface __ASYNC_OUTSIDE_LOADING_BOUNDARY__ { readonly __ASYNC_OUTSIDE_LOADING_BOUNDARY__: never }
export interface __ERROR_OUTSIDE_ERRORED_BOUNDARY__ { readonly __ERROR_OUTSIDE_ERRORED_BOUNDARY__: never }
export interface __PENDING_ASYNC_FORBIDDEN_SCOPE__ { readonly __PENDING_ASYNC_FORBIDDEN_SCOPE__: never }
export interface __UNHANDLED_HANDLER_FAILURE__ { readonly __UNHANDLED_HANDLER_FAILURE__: never }
export interface __SETUP_MAY_THROW__ { readonly __SETUP_MAY_THROW__: never }

// ---- sources --------------------------------------------------------------------
export declare function signal<T>(value?: T, options?: unknown): [Src<T, false, never>, (v: unknown) => void];
/** createMemo(fn): pending if any dep is or the compute returns a promise; failures from deps, the pre-pass, and rejections. */
export declare function memo<T, D extends readonly unknown[], E>(compute: () => T, deps: D, fails: Fails<E>): Src<Settle<T>, PendingOf<D> extends true ? true : IsPromise<T>, FailsOf<D> | E>;
/** A worst-case value (an unanalyzed construct). */
export declare function worst(value: unknown): Worst;
/** What Show / For / Errored hand to a render callback (an accessor, or a keyed For's plain item): the
 * transform binds the parameter as a safe accessor for dependency extraction; here it is `any` so the
 * user's own property accesses and prop assignments keep type-checking. */
export type Acc = any;
export declare function acc(value: unknown): Acc;

// ---- reads by scope -----------------------------------------------------------------
type SetupReadable<S> = IsAny<S> extends true ? unknown : S extends Worst ? unknown : S extends Src<unknown, infer P, unknown> ? (P extends true ? __PENDING_ASYNC_UNTRACKED_READ__ : __STRICT_READ_UNTRACKED__) : unknown;
/** A call of a source in a component's setup: an error unless the value is held. */
export declare function setupRead<S>(source: S & SetupReadable<S>): S extends Src<infer T, boolean, unknown> ? T : S extends (...a: never[]) => infer R ? R : S;
/** Setup code that may fail (pre-pass): an error unless E is never. */
export declare function setupFails<E>(fails: Fails<E> & ([E] extends [never] ? unknown : __SETUP_MAY_THROW__)): void;
type EffectReadable<D extends readonly unknown[]> = PendingOf<D> extends true ? __PENDING_ASYNC_FORBIDDEN_SCOPE__ : unknown;
/** createEffect(compute, effect): the compute's pending / failures are the component's; the effect fn may not read pending. */
export declare function effect<DC extends readonly unknown[], DF extends readonly unknown[], E>(compute: () => unknown, computeDeps: DC, fn: (v: any) => unknown, fnDeps: DF & EffectReadable<DF>, fails: Fails<E>): View<PendingOf<DC>, FailsOf<DC> | E>;

// ---- views ----------------------------------------------------------------------------
/** A JSX expression container (or attribute) read in a tracking scope. */
export declare function track<D extends readonly unknown[], E = never>(compute: () => unknown, deps: D, fails?: Fails<E>): View<PendingOf<D>, FailsOf<D> | E>;
/** An intrinsic element: attributes and children fold. */
export declare function host<A extends readonly unknown[], C extends readonly unknown[]>(tag: string, attrs: A, children: C): View<PendingOf<A> extends true ? true : PendingOf<C>, FailsOf<A> | FailsOf<C>>;
/** A user component: the caller's boundaries cover what its props carry (D-119) and what its view carries. */
export declare function el<Props, R, PV extends readonly unknown[]>(component: (props: Props) => R, props: Props, propViews: PV): View<PendingOf<PV> extends true ? true : R extends View<infer P, unknown> ? P : false, FailsOf<PV> | (R extends View<boolean, infer E> ? E : never)>;
/** A prop value: wraps the caller's expression so its colors ride along without changing the child's declared type. */
export declare function prop<T, D extends readonly unknown[], E = never>(value: () => T, deps: D, fails?: Fails<E>): T;
export declare function propView<D extends readonly unknown[], E = never>(deps: D, fails?: Fails<E>): View<PendingOf<D>, FailsOf<D> | E>;
export declare function loading<F, C extends readonly unknown[]>(fallback: F, children: C): View<PendingOf<[F]>, FailsOf<[F]> | FailsOf<C>>;
export declare function errored<F, C extends readonly unknown[]>(fallback: F, children: C): View<PendingOf<[F]> extends true ? true : PendingOf<C>, FailsOf<[F]>>;
/** Show / For / Switch / Match: transparent to pending and failure; render callbacks get safe accessors. */
export declare function flow<W extends readonly unknown[], C extends readonly unknown[], K extends readonly unknown[]>(control: string, when: W, children: C, callbacks: K): View<PendingOf<W> extends true ? true : PendingOf<C> extends true ? true : PendingOf<K>, FailsOf<W> | FailsOf<C> | FailsOf<K>>;
/** A render callback (Show / For / Errored fallback): its parameters are safe accessors; its body a view. */
export declare function callbackView<R>(fn: (...a: Acc[]) => R): R extends View<infer P, infer E> ? View<P, E> : View<false, never>;
/** Fragment / conditional / list of views. */
export declare function views<C extends readonly unknown[]>(children: C): View<PendingOf<C>, FailsOf<C>>;
/** A component's returned view together with the effects it owns. */
export declare function own<V extends readonly unknown[]>(parts: V): View<PendingOf<V>, FailsOf<V>>;

// ---- handlers ----------------------------------------------------------------------------
/** A handler (event attribute, callback prop, timer / promise callback): the pre-pass failure set must be empty. */
export declare function handler<E>(fn: ((...args: any[]) => unknown) | object | undefined, fails: Fails<E> & ([E] extends [never] ? unknown : __UNHANDLED_HANDLER_FAILURE__)): View<false, never>;
/** A callback handed to a consumer that runs it detached (a timer, a promise continuation): its failures must be handled inside. */
export declare function checked<F extends (...args: any[]) => unknown, E>(fn: F, fails: Fails<E> & ([E] extends [never] ? unknown : __UNHANDLED_HANDLER_FAILURE__)): F;
/** Several setup reads at once (a sync helper or getter called from setup): an error if any dependency is a source. */
type SetupReadableAll<D extends readonly unknown[]> = true extends (D[number] extends infer X ? (IsAny<X> extends true ? false : X extends Worst ? false : X extends Src<unknown, boolean, unknown> ? true : false) : false) ? (true extends PendingOf<D> ? __PENDING_ASYNC_UNTRACKED_READ__ : __STRICT_READ_UNTRACKED__) : unknown;
export declare function setupReads<D extends readonly unknown[]>(deps: D & SetupReadableAll<D>): void;
/** A reactive prop (the pre-pass found a caller passing a reactive expression), as a source for setup-read checks. */
export declare function propSrc<T>(value: T): Src<T, false, never>;
/** JSX children of a user component are rendered under the caller's boundaries; the prop itself is typed never. */
export declare function jsxChildren(): never;

// ---- roots ---------------------------------------------------------------------------------
type RootReady<V> = V extends View<infer P, infer E> ? ((P extends true ? __ASYNC_OUTSIDE_LOADING_BOUNDARY__ : unknown) & ([E] extends [never] ? unknown : __ERROR_OUTSIDE_ERRORED_BOUNDARY__)) : unknown;
/** render(() => <App />, el) / render(App, el): the view must be settled and safe. */
export declare function render<V>(view: (() => V) & RootReady<V>, element: unknown): void;
export declare function renderComponent<V>(component: ((props: never) => V) & RootReady<V>, element: unknown): void;
/** A component handed off as a value: a root for its obligations. */
export declare function handoff<P, V>(component: ((props: P) => V) & RootReady<V>): (props: P) => V;
/** An exported, never-rendered component: no error; the color is informational. */
export declare function exported<V>(component: (props: never) => V): V;
