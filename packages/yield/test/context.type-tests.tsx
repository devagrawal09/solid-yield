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
  hydrate,
  render,
  Show,
  $signal,
  view,
  type ContextNames,
  type ContextValue,
  type ContextRead,
  type Element,
  type Path,
  type Props,
  type RequiredContext,
  type RequiresOf,
  type Source,
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
// the refusal names a named context by its name, an unnamed one by its type
type _named = Expect<Equal<ContextNames<typeof UserCtx>, "UserCtx">>;
const Unnamed = createContext<User>();
type _unnamed = Expect<Equal<ContextNames<typeof Unnamed>, RequiredContext<User, string>>>;
type _fold = Expect<
  Equal<RequiresOf<ContextRead<typeof UserCtx> | ContextRead<never>>, typeof UserCtx>
>;

// --- a hole prop does not carry a requirement ----------------------------------------------

const Frame = component(function* Frame(props: Props<{ children: Element }>) {
  return view(function* () {
    return <section>{yield* props.children}</section>;
  });
});
const Framed = component(function* Framed() {
  return view(function* () {
    return (
      <>
        {
          yield* Frame({
            // @ts-expect-error a prop declares no requirement: provide it inside the hole
            children: function* () {
              return <>{yield* Avatar()}</>;
            }
          })
        }
      </>
    );
  });
});
const FramedProvided = component(function* FramedProvided() {
  return view(function* () {
    return (
      <>
        {
          yield* Frame({
            children: function* () {
              return (
                <>
                  {
                    yield* UserCtx.provide({
                      value: { name: "x" },
                      children: function* () {
                        return <>{yield* Avatar()}</>;
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
render(FramedProvided, root);
void Framed;

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
