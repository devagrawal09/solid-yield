/**
 * Type tests for context requirements, the fourth color (D-098). A setup's
 * read of a context created without a default adds the context to its
 * component's type; `Ctx.provide` around a call discharges it; `render`,
 * `hydrate` and `foreign()` refuse a component that still requires one. The
 * runtime half is runtime.spec.tsx, "context". Type-checked by `test-types`.
 */
import {
  component,
  createContext,
  constant,
  For,
  foreign,
  lazy,
  hydrate,
  render,
  Show,
  $signal,
  view,
  type ContextNames,
  type ContextValue,
  type ContextRead,
  type Component,
  type Element,
  type Path,
  type Props,
  type RequiredContext,
  type RequiresOf,
  type Source,
  type UnnamedContext,
  type View,
  type YieldContext
} from "solid-yield";
import { h } from "solid-yield/h";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
/** A component's requirements (its fourth color). */
type RequiresOfComponent<C> = C extends (...args: any[]) => View<any, any, any, infer R>
  ? R
  : never;

interface User {
  name: string;
}
class FetchFailure extends Error {
  readonly kind = "fetch" as const;
}
declare const failing: Source<Element, FetchFailure>;
const UserCtx = createContext<User, "UserCtx">();
const ThemeCtx = createContext("light");
declare const root: HTMLElement;

// --- the context and its read ---------------------------------------------------------------

// a context without a default is required; one with a default is not
type _required = Expect<Equal<typeof UserCtx, RequiredContext<User, "UserCtx">>>;
type _defaulted = Expect<Equal<typeof ThemeCtx, YieldContext<string, string>>>;
// `yield* UserCtx` yields `ContextRead<typeof UserCtx>`; a defaulted read requires nothing
type ReadOf<C> = C extends { [Symbol.iterator](): Generator<infer Y, any, any> } ? Y : never;
type _read = Expect<Equal<ReadOf<typeof UserCtx>, ContextRead<typeof UserCtx>>>;
type _readDefault = Expect<Equal<ReadOf<typeof ThemeCtx>, ContextRead<never>>>;
// the value is read like a prop (D-042): a path, never the value
type _value = Expect<Equal<ContextValue<User>, Path<User>>>;
type _valueSource = Expect<Equal<ContextValue<Source<User, never, true>>, Path<User, never, true>>>;

// --- requirement in ------------------------------------------------------------------------

const Avatar = component(function* Avatar() {
  const user = yield* UserCtx;
  return view(function* () {
    return <b>{yield* user.name}</b>;
  });
});
type _in = Expect<Equal<RequiresOfComponent<typeof Avatar>, typeof UserCtx>>;

// a defaulted context adds no requirement
const Themed = component(function* Themed() {
  const theme = yield* ThemeCtx;
  return view(function* () {
    return <i>{yield* theme}</i>;
  });
});
type _defaultNone = Expect<Equal<RequiresOfComponent<typeof Themed>, never>>;
render(Themed, root);
// so does a D-060 constant default
const Nobody = createContext(constant<User | null>(null));
const ReadsNobody = component(function* ReadsNobody() {
  const who = yield* Nobody;
  return view(function* () {
    return <i>{(yield* who)?.name}</i>;
  });
});
type _constantNone = Expect<Equal<RequiresOfComponent<typeof ReadsNobody>, never>>;

// --- through calls: a child's, a child-of-child's -------------------------------------------

const Card = component(function* Card() {
  return view(function* () {
    return <div>{yield* Avatar()}</div>;
  });
});
const Page = component(function* Page() {
  return view(function* () {
    return <main>{yield* Card()}</main>;
  });
});
type _childOfChild = Expect<Equal<RequiresOfComponent<typeof Page>, typeof UserCtx>>;

// through a flow control's lazy view and a row
const Shown = component(function* Shown(props: Props<{ on: boolean }>) {
  return view(function* () {
    return (
      <>
        {
          yield* Show({
            when: props.on,
            children: function* () {
              return <>{yield* Avatar()}</>;
            }
          })
        }
      </>
    );
  });
});
type _flow = Expect<Equal<RequiresOfComponent<typeof Shown>, typeof UserCtx>>;
const Rows = component(function* Rows() {
  const [items] = yield* $signal([1, 2]);
  return view(function* () {
    return (
      <ul>
        {
          yield* For({
            each: items,
            children: function* () {
              // a row's setup reads it: resolved under the list, so the list requires it
              const user = yield* UserCtx;
              return view(function* () {
                return <li>{yield* user.name}</li>;
              });
            }
          })
        }
      </ul>
    );
  });
});
type _row = Expect<Equal<RequiresOfComponent<typeof Rows>, typeof UserCtx>>;
// through `h`
const HCard = component(function* HCard() {
  return view(function* () {
    return h("div", Avatar());
  });
});
type _h = Expect<Equal<RequiresOfComponent<typeof HCard>, typeof UserCtx>>;

// --- discharged by provide around the call ----------------------------------------------------

const App = component(function* App() {
  const [user] = yield* $signal<User>({ name: "ada" });
  return view(function* () {
    return (
      <>
        {
          yield* UserCtx.provide({
            value: user,
            children: function* () {
              return <>{yield* Page()}</>;
            }
          })
        }
      </>
    );
  });
});
type _discharged = Expect<Equal<RequiresOfComponent<typeof App>, never>>;
render(App, root);
render(() => App(), root);
hydrate(App, document);

// provide's value takes what a prop takes (D-065): a value, a source, a hole
const Values = component(function* Values() {
  const [user] = yield* $signal<User>({ name: "ada" });
  return view(function* () {
    return (
      <>
        {
          yield* UserCtx.provide({
            value: { name: "plain" },
            children: function* () {
              return <>{yield* Avatar()}</>;
            }
          })
        }
        {
          yield* UserCtx.provide({
            value: function* () {
              return { name: (yield* user).name.toUpperCase() };
            },
            children: function* () {
              return <>{yield* Avatar()}</>;
            }
          })
        }
      </>
    );
  });
});
type _values = Expect<Equal<RequiresOfComponent<typeof Values>, never>>;
declare const pendingUser: Source<User, never, true>;
UserCtx.provide({
  // @ts-expect-error a context of settled values does not take a pending source
  value: pendingUser,
  children: function* () {
    return <>{yield* Avatar()}</>;
  }
});

// a provider of another context does not discharge it (the value type is invariant)
const OtherCtx = createContext<{ name: string; admin: true }, "OtherCtx">();
const Wrong = component(function* Wrong() {
  return view(function* () {
    return (
      <>
        {
          yield* OtherCtx.provide({
            value: { name: "x", admin: true },
            children: function* () {
              return <>{yield* Avatar()}</>;
            }
          })
        }
      </>
    );
  });
});
type _wrong = Expect<Equal<RequiresOfComponent<typeof Wrong>, typeof UserCtx>>;

// two requirements; one provider discharges its own only
const Both = component(function* Both() {
  const other = yield* OtherCtx;
  return view(function* () {
    return (
      <>
        {yield* other.name}
        {yield* Avatar()}
      </>
    );
  });
});
type _both = Expect<Equal<RequiresOfComponent<typeof Both>, typeof UserCtx | typeof OtherCtx>>;
const OneProvided = component(function* OneProvided() {
  return view(function* () {
    return (
      <>
        {
          yield* UserCtx.provide({
            value: { name: "x" },
            children: function* () {
              return <>{yield* Both()}</>;
            }
          })
        }
      </>
    );
  });
});
type _one = Expect<Equal<RequiresOfComponent<typeof OneProvided>, typeof OtherCtx>>;

// --- NOT discharged by a provide inside the reading component's own view --------------------

// its setup's read was resolved where the component was created, above the provider
const SelfProvider = component(function* SelfProvider() {
  const user = yield* UserCtx;
  return view(function* () {
    return (
      <>
        {
          yield* UserCtx.provide({
            value: { name: "inner" },
            children: function* () {
              return <b>{yield* user.name}</b>;
            }
          })
        }
      </>
    );
  });
});
type _self = Expect<Equal<RequiresOfComponent<typeof SelfProvider>, typeof UserCtx>>;
// so it surfaces at the root
// @ts-expect-error [NO_PROVIDER] the root requires UserCtx
render(SelfProvider, root);

// --- the root, hydrate and foreign() refuse it, naming the context ----------------------------

// @ts-expect-error [NO_PROVIDER] the root requires UserCtx
render(Page, root);
// @ts-expect-error [NO_PROVIDER]
render(() => Page(), root);
// @ts-expect-error [NO_PROVIDER]
hydrate(Page, document);
// @ts-expect-error [NO_PROVIDER] a component handed to plain Solid requires UserCtx
foreign(Page);
foreign(App);
// the refusal names the context by its name
type _named = Expect<Equal<ContextNames<typeof UserCtx>, "UserCtx">>;
type _fold = Expect<
  Equal<RequiresOf<ContextRead<typeof UserCtx> | ContextRead<never>>, typeof UserCtx>
>;

// --- requirements are nominal (D-098 amended): two contexts are two providers -----------------

// a context without a default and without a name is refused, at the call and in its result
// @ts-expect-error [UNNAMED_CONTEXT] a context without a default needs a name
const Unnamed = createContext<User>();
type _unnamed = Expect<Equal<typeof Unnamed, UnnamedContext>>;
// @ts-expect-error [UNNAMED_CONTEXT] an explicit `string` is no name
export const UnnamedString = createContext<User, string>();
export const ReadsUnnamed = component(function* ReadsUnnamed() {
  // @ts-expect-error the unnamed context cannot be read
  const user = yield* Unnamed;
  return view(function* () {
    return <b>{user}</b>;
  });
});
// @ts-expect-error nor provided
Unnamed.provide;
// a context with a default needs no name: it carries no requirement
const Fallback = createContext<User>({ name: "anonymous" });
type _defaultedUnnamed = Expect<Equal<typeof Fallback, YieldContext<User, string>>>;
const ReadsFallback = component(function* ReadsFallback() {
  const user = yield* Fallback;
  return view(function* () {
    return <b>{yield* user.name}</b>;
  });
});
render(ReadsFallback, root);

// two contexts of one value type are two requirements: the second's provider does not satisfy
// the first, and the root names the first
const AuthorCtx = createContext<User, "AuthorCtx">();
const EditorCtx = createContext<User, "EditorCtx">();
const Byline = component(function* Byline() {
  const author = yield* AuthorCtx;
  return view(function* () {
    return <i>{yield* author.name}</i>;
  });
});
const EditorOnly = component(function* EditorOnly() {
  return view(function* () {
    return (
      <>
        {
          yield* EditorCtx.provide({
            value: { name: "ed" },
            children: function* () {
              return <>{yield* Byline()}</>;
            }
          })
        }
      </>
    );
  });
});
type _twoTypes = Expect<Equal<RequiresOfComponent<typeof EditorOnly>, typeof AuthorCtx>>;
type _twoNames = Expect<Equal<ContextNames<RequiresOfComponent<typeof EditorOnly>>, "AuthorCtx">>;
// @ts-expect-error [NO_PROVIDER] the root requires "AuthorCtx"
render(EditorOnly, root);
// its own (named) provider discharges it
const AuthorProvided = component(function* AuthorProvided() {
  return view(function* () {
    return (
      <>
        {
          yield* AuthorCtx.provide({
            value: { name: "au" },
            children: function* () {
              return <>{yield* Byline()}</>;
            }
          })
        }
      </>
    );
  });
});
type _ownDischarges = Expect<Equal<RequiresOfComponent<typeof AuthorProvided>, never>>;
render(AuthorProvided, root);

// --- a requirement flows out of a hole prop through the call (D-098 amended) -----------------

// a hole runs under the component it is given to, so a provider around that component's call is
// above it: the call carries what the props literal's holes require
const Greeting = component(function* Greeting() {
  const user = yield* UserCtx;
  return view(function* () {
    return <p>hello {yield* user.name}</p>;
  });
});
const Layout = component(function* Layout(props: Props<{ children: Element }>) {
  return view(function* () {
    return <main>{yield* props.children}</main>;
  });
});
// the ruling's example: Greeting's requirement reaches the provide around Layout's call
const HoleApp = component(function* HoleApp() {
  return view(function* () {
    return (
      <>
        {
          yield* UserCtx.provide({
            value: { name: "ada" },
            children: function* () {
              return (
                <>
                  {
                    yield* Layout({
                      children: function* () {
                        return <>{yield* Greeting({})}</>;
                      }
                    })
                  }
                </>
              );
            }
          })
        }
      </>
    );
  });
});
type _holeApp = Expect<Equal<RequiresOfComponent<typeof HoleApp>, never>>;
render(HoleApp, root);
// the call itself carries it
const LaidOut = component(function* LaidOut() {
  return view(function* () {
    return (
      <>
        {
          yield* Layout({
            children: function* () {
              return <>{yield* Greeting({})}</>;
            }
          })
        }
      </>
    );
  });
});
type _holeCarried = Expect<Equal<RequiresOfComponent<typeof LaidOut>, typeof UserCtx>>;
// no provider: the root refuses it, naming the context
type _holeNamed = Expect<Equal<ContextNames<RequiresOfComponent<typeof LaidOut>>, "UserCtx">>;
// @ts-expect-error [NO_PROVIDER] the root requires "UserCtx"
render(LaidOut, root);
// a provider wrapping the call discharges it (as above), one around the component that holds the
// call too
const AroundLaidOut = component(function* AroundLaidOut() {
  return view(function* () {
    return (
      <>
        {
          yield* UserCtx.provide({
            value: { name: "x" },
            children: function* () {
              return <>{yield* LaidOut()}</>;
            }
          })
        }
      </>
    );
  });
});
type _aroundHolder = Expect<Equal<RequiresOfComponent<typeof AroundLaidOut>, never>>;
// a provider of another context does not
const WrongAroundCall = component(function* WrongAroundCall() {
  return view(function* () {
    return (
      <>
        {
          yield* OtherCtx.provide({
            value: { name: "x", admin: true },
            children: function* () {
              return (
                <>
                  {
                    yield* Layout({
                      children: function* () {
                        return <>{yield* Greeting({})}</>;
                      }
                    })
                  }
                </>
              );
            }
          })
        }
      </>
    );
  });
});
type _wrongAround = Expect<Equal<RequiresOfComponent<typeof WrongAroundCall>, typeof UserCtx>>;
// any hole prop, not only children; each hole's requirements join the call's
const Pair = component(function* Pair(props: Props<{ left: Element; right: Element; n: number }>) {
  return view(function* () {
    return (
      <div>
        {yield* props.left}
        {yield* props.right}
        {yield* props.n}
      </div>
    );
  });
});
const Paired = component(function* Paired() {
  return view(function* () {
    return (
      <>
        {
          yield* Pair({
            left: function* () {
              return <>{yield* Greeting({})}</>;
            },
            right: function* () {
              return <>{yield* Both()}</>;
            },
            n: 1
          })
        }
      </>
    );
  });
});
type _paired = Expect<Equal<RequiresOfComponent<typeof Paired>, typeof UserCtx | typeof OtherCtx>>;
// a hole that provides inside itself carries nothing out
const FramedProvided = component(function* FramedProvided() {
  return view(function* () {
    return (
      <>
        {
          yield* Layout({
            children: function* () {
              return (
                <>
                  {
                    yield* UserCtx.provide({
                      value: { name: "x" },
                      children: function* () {
                        return <>{yield* Greeting({})}</>;
                      }
                    })
                  }
                </>
              );
            }
          })
        }
      </>
    );
  });
});
type _holeProvided = Expect<Equal<RequiresOfComponent<typeof FramedProvided>, never>>;
render(FramedProvided, root);
// conservative: a provider inside Layout's own view, around `props.children`, is above the hole at
// run time, but Layout's type does not say what it provides, so the requirement still reaches
// the call (and the root refuses it)
const ProvidingLayout = component(function* ProvidingLayout(props: Props<{ children: Element }>) {
  return view(function* () {
    return (
      <>
        {
          yield* UserCtx.provide({
            value: { name: "inside" },
            children: function* () {
              return <main>{yield* props.children}</main>;
            }
          })
        }
      </>
    );
  });
});
const InsideProvided = component(function* InsideProvided() {
  return view(function* () {
    return (
      <>
        {
          yield* ProvidingLayout({
            children: function* () {
              return <>{yield* Greeting({})}</>;
            }
          })
        }
      </>
    );
  });
});
type _inside = Expect<Equal<RequiresOfComponent<typeof InsideProvided>, typeof UserCtx>>;
// a hole given as a source (forwarded) requires nothing: its requirements were its caller's
const Forwards = component(function* Forwards(props: Props<{ children: Element }>) {
  return view(function* () {
    return <>{yield* Layout({ children: props.children })}</>;
  });
});
type _forwarded = Expect<Equal<RequiresOfComponent<typeof Forwards>, never>>;
// the props literal is generic, so an undeclared prop is refused by name (an excess-property check
// does not apply to it)
// @ts-expect-error [UNDECLARED_PROP] `extra` is not a declared prop
export const undeclared = Layout({ children: "x", extra: 1 });
// a component's type without a literal (`ReturnType`, a plain `Component<D>`) requires its own only
type _returnType = Expect<Equal<RequiresOfComponent<typeof Layout>, never>>;
export const asPlain: Component<{ children: Element }> = Layout;

// D-029's generic pass-through components keep their type parameters, and their hole props carry
// no requirement (TypeScript cannot keep both: a generic component's call is not generic in its
// props literal): provide inside the hole
const GenericFrame = component(function* GenericFrame<E>(
  props: Props<{ children: Source<Element, E> }>
) {
  return view(function* () {
    return <section>{yield* props.children}</section>;
  });
});
export const genericKept: View<false, FetchFailure> = GenericFrame({ children: failing });
const GenericFramed = component(function* GenericFramed() {
  return view(function* () {
    return (
      <>
        {
          yield* GenericFrame({
            // @ts-expect-error a generic component's hole prop carries no requirement
            children: function* () {
              return <>{yield* Greeting({})}</>;
            }
          })
        }
      </>
    );
  });
});
void GenericFramed;

// `h(Comp, props)` and `lazy` do not take a props literal's requirements: there a hole prop that
// requires a context is refused (children given to `h` as arguments carry theirs, as before)
export const hPair = h(Pair, {
  // @ts-expect-error a hole prop given to h(Comp, props) carries no requirement
  left: function* () {
    return <>{yield* Greeting({})}</>;
  },
  right: "r",
  n: 1
});
const LazyLayout = lazy(() => Promise.resolve({ default: Layout }));
export const LazyLaidOut = component(function* LazyLaidOut() {
  return view(function* () {
    return (
      <>
        {
          yield* LazyLayout({
            // @ts-expect-error a lazy component's hole prop carries no requirement
            children: function* () {
              return <>{yield* Greeting({})}</>;
            }
          })
        }
      </>
    );
  });
});

// --- `h`: h(Ctx.provide, { value }, ...children) discharges as the call form does ------------

// `h(Avatar, {})` is created inside the provider: discharged
const HApp = component(function* HApp() {
  return view(function* () {
    return h(UserCtx.provide, { value: { name: "h" } }, h("div", h(Avatar, {})));
  });
});
type _hProvide = Expect<Equal<RequiresOfComponent<typeof HApp>, never>>;
render(HApp, root);
// `Avatar()` called in h's arguments runs when the view runs, before the
// provider exists: not discharged; the component requires it (and a provider
// around the component's call does discharge it)
const HEager = component(function* HEager() {
  return view(function* () {
    return h(UserCtx.provide, { value: { name: "h" } }, h("div", Avatar()));
  });
});
type _hEager = Expect<Equal<RequiresOfComponent<typeof HEager>, typeof UserCtx>>;
const HEagerProvided = component(function* HEagerProvided() {
  return view(function* () {
    return h(UserCtx.provide, { value: { name: "outer" } }, h(HEager, {}));
  });
});
type _hEagerProvided = Expect<Equal<RequiresOfComponent<typeof HEagerProvided>, never>>;
const HWrong = component(function* HWrong() {
  return view(function* () {
    return h(OtherCtx.provide, { value: { name: "h", admin: true } }, h("div", h(Avatar, {})));
  });
});
type _hWrong = Expect<Equal<RequiresOfComponent<typeof HWrong>, typeof UserCtx>>;

// --- F-3: provide's value is never undefined (Solid reads it as unset, S11) -------------------
// A context that may carry nothing models it inside the value: null, or a source of T | null.
const MaybeUserCtx = createContext<User | null | undefined, "MaybeUserCtx">();
const MaybeAvatar = component(function* MaybeAvatar() {
  const user = yield* MaybeUserCtx;
  return view(function* () {
    return <i>{(yield* user)?.name ?? "nobody"}</i>;
  });
});
MaybeUserCtx.provide({
  // @ts-expect-error [PROVIDE_UNDEFINED] a provided undefined reads as no provider
  value: undefined,
  children: function* () {
    return <>{yield* MaybeAvatar()}</>;
  }
});
const nobody = MaybeUserCtx.provide({
  value: null,
  children: function* () {
    return <>{yield* MaybeAvatar()}</>;
  }
});
render(() => nobody, root);
declare const maybeUser: Source<User | undefined>;
// a source is provided whatever it reads
MaybeUserCtx.provide({
  value: maybeUser,
  children: function* () {
    return <>{yield* MaybeAvatar()}</>;
  }
});
// a context of sources: the source's value type is checked the same way
const MaybeSourceCtx = createContext<Source<User | undefined>, "MaybeSourceCtx">();
MaybeSourceCtx.provide({
  // @ts-expect-error [PROVIDE_UNDEFINED]
  value: undefined,
  children: "x"
});
// h's provider overload too
// @ts-expect-error [PROVIDE_UNDEFINED]
h(MaybeUserCtx.provide, { value: undefined }, h(MaybeAvatar, {}));
export const hNobody = h(MaybeUserCtx.provide, { value: null }, h(MaybeAvatar, {}));
// a context whose type does not admit undefined has no message to show
export type NoMessage = Expect<
  Equal<
    Extract<Parameters<typeof UserCtx.provide>[0]["value"], { readonly [k: string]: never }>,
    never
  >
>;
