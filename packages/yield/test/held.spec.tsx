/**
 * D-118: "the only things going through props are reactive values and
 * events; everything else is a bag of those two things." A prop (and a
 * context's provided value) is given to the child as it is: a reactive one
 * (a source, a path, a hole) as a path read where it is read, an `$event`
 * handler as itself, anything else held. The patterns issue #2 asked for —
 * a lens, a state container, a module that also works alone — are written
 * here with nothing else. Views are written with `yield*` in JSX (the
 * transform's rule runs in this suite).
 */
import { createRoot, flush } from "solid-js";
import {
  $event,
  $memo,
  $signal,
  $store,
  component,
  constant,
  createContext,
  render,
  view,
  type Handler,
  type Path,
  type Props,
  type Source
} from "solid-yield";
import { h } from "solid-yield/h";
import { bindEvent } from "solid-yield/internal";

const tick = () => new Promise<void>(r => setTimeout(r, 0));
async function settle(times = 3) {
  for (let i = 0; i < times; i++) {
    await tick();
    flush();
  }
}

let root: HTMLDivElement;
let dispose: (() => void) | undefined;
beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  root.remove();
});
function mount(App: () => any) {
  dispose = render(App as any, root);
  flush();
}
const click = (selector: string, at = 0) =>
  root.querySelectorAll<HTMLElement>(selector)[at]!.click();
const texts = (selector: string) =>
  [...root.querySelectorAll(selector)].map(e => e.firstChild?.textContent ?? "");

describe("D-118: props are given as they are", () => {
  it("a held constant, a bag and a plain function arrive as themselves; a bag's leaves are what the caller put there", async () => {
    let seen: Record<string, unknown> = {};
    const calls: string[] = [];
    type Tools = { label: Path<string>; clear: Handler<[why: string]> };
    const Child = component(function* Child(
      props: Props<{ room: string; tools: Tools; format: (s: string) => string }>
    ) {
      seen = { room: props.room, tools: props.tools, format: props.format };
      const go = $event(function* () {
        yield* props.tools.clear("event");
      });
      return view(function* () {
        return (
          <p>
            {props.format(props.room)}:{yield* props.tools.label}
            <button onClick={yield* go}>go</button>
            <button class="bound" onClick={[yield* props.tools.clear, "bound"]}>
              bound
            </button>
          </p>
        );
      });
    });
    let given: Record<string, unknown> = {};
    let rename!: (v: string) => void;
    const Parent = component(function* Parent() {
      const [store, setStore] = yield* $store({ label: "a" });
      rename = v =>
        createRoot(() =>
          bindEvent(
            $event(function* () {
              yield* setStore(s => {
                s.label = v;
              });
            })
          )
        )();
      const tools: Tools = {
        label: store.label,
        clear: $event(function* (why: string) {
          calls.push(why);
        })
      };
      const format = (s: string) => s.toUpperCase();
      given = { room: "lobby", tools, format };
      return view(function* () {
        return <>{yield* Child({ room: "lobby", tools, format })}</>;
      });
    });
    mount(Parent);
    // held, not read: the very values the caller passed
    expect(seen.room).toBe("lobby");
    expect(seen.tools).toBe(given.tools);
    expect(seen.format).toBe(given.format);
    expect(root.querySelector("p")!.firstChild!.textContent).toBe("LOBBY");
    // a path leaf is read where it is read
    rename("b");
    await settle();
    expect(root.querySelector("p")!.textContent).toMatch(/^LOBBY:b/);
    // a handler leaf is called and bound with one yield*
    click("button");
    click(".bound");
    await settle();
    expect(calls).toEqual(["event", "bound"]);
  });

  it("a reactive top-level prop is a path: a source, a hole and a path are read where they are read", async () => {
    let set!: (v: number) => void;
    const Child = component(function* Child(
      props: Props<{ a: Source<number>; b: Source<number>; c: Source<{ n: number }> }>
    ) {
      return view(function* () {
        return (
          <i>
            {yield* props.a}/{yield* props.b}/{yield* props.c.n}
          </i>
        );
      });
    });
    const Parent = component(function* Parent() {
      const [n, setN] = yield* $signal(1);
      const [store] = yield* $store({ c: { n: 10 } });
      set = v =>
        createRoot(() =>
          bindEvent(
            $event(function* () {
              yield* setN(v);
            })
          )
        )();
      return view(function* () {
        return (
          <>
            {
              yield* Child({
                a: n,
                b: function* () {
                  return (yield* n) * 2;
                },
                c: store.c
              })
            }
          </>
        );
      });
    });
    mount(Parent);
    expect(root.textContent).toBe("1/2/10");
    set(3);
    await settle();
    expect(root.textContent).toBe("3/6/10");
  });

  it("in h: a held value of any kind reaches the child intact; a reactive one is a path", async () => {
    let seen: Record<string, unknown> = {};
    let calls = 0;
    const Child = component(function* Child(
      props: Props<{ n: Source<number>; bag: { tag: string }; onClear: Handler; fn: () => string }>
    ) {
      seen = { bag: props.bag, onClear: props.onClear, fn: props.fn };
      const go = $event(function* () {
        yield* props.onClear();
      });
      return view(function* () {
        return h("button", { onClick: go }, props.fn(), ":", props.n);
      });
    });
    const bag = { tag: "t" };
    const fn = () => "f";
    let clear: unknown;
    const Parent = component(function* Parent() {
      const [n] = yield* $signal(7);
      const onClear = $event(function* () {
        calls++;
      });
      clear = onClear;
      return view(function* () {
        return h(Child, { n, bag, onClear, fn });
      });
    });
    mount(() => h(Parent, {}));
    // Solid's h would have read the source, called the handler and the function where the child
    // read them: handed over unread (REFS)
    expect(seen).toEqual({ bag, onClear: clear, fn });
    expect(calls).toBe(0);
    expect(root.textContent).toBe("f:7");
    click("button");
    await settle();
    expect(calls).toBe(1);
  });

  it("a handler prop given as a hole, forced past the types ([HANDLER_PROP]), is a path: calling it fails", async () => {
    let failure: unknown;
    let go!: () => unknown;
    const Child = component(function* Child(props: Props<{ onClear: Handler }>) {
      const run = $event(function* () {
        yield* props.onClear();
      });
      go = run;
      return view(function* () {
        return <button onClick={yield* run}>x</button>;
      });
    });
    const Parent = component(function* Parent() {
      const clear = $event(function* () {});
      return view(function* () {
        return (
          <>
            {yield* Child({
              // @ts-expect-error [HANDLER_PROP] a handler prop takes an $event, not a hole
              onClear: function* () {
                return clear;
              }
            })}
          </>
        );
      });
    });
    mount(Parent);
    // dispatched as the DOM dispatches a bound handler (no Errored: the call rejects)
    const bound = createRoot(() => bindEvent(go));
    await (bound() as Promise<unknown>).catch((e: unknown) => (failure = e));
    // a path is not callable (V8 words it "yield* (intermediate value) is not iterable")
    expect(String(failure)).toMatch(/not iterable|not a function/);
  });
});

describe("D-118: a context's provided value is given as a prop is", () => {
  it("a held context gives its value as it is, a bag's handler callable; a reactive one a path", async () => {
    const calls: string[] = [];
    type Tools = { at: Path<{ n: number }>; bump: Handler };
    const ToolsCtx = createContext<Tools, "ToolsCtx">(undefined, { name: "ToolsCtx" });
    const NameCtx = createContext<Source<string>, "NameCtx">(undefined, { name: "NameCtx" });
    let held: unknown;
    const Reader = component(function* Reader() {
      const tools = yield* ToolsCtx;
      const name = yield* NameCtx;
      held = tools;
      const go = $event(function* () {
        calls.push("go");
        yield* tools.bump();
      });
      return view(function* () {
        return (
          <button onClick={yield* go}>
            {yield* name}:{yield* tools.at.n}
          </button>
        );
      });
    });
    let given: unknown;
    const App = component(function* App() {
      const [state, setState] = yield* $store({ n: 1 });
      const tools: Tools = {
        at: state,
        bump: $event(function* () {
          yield* setState(s => {
            s.n++;
          });
        })
      };
      given = tools;
      return view(function* () {
        return (
          <>
            {
              yield* ToolsCtx.provide({
                value: tools,
                children: function* () {
                  return (
                    <>
                      {
                        yield* NameCtx.provide({
                          value: constant("ada"),
                          children: function* () {
                            return <>{yield* Reader()}</>;
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
    mount(App);
    expect(held).toBe(given);
    expect(root.textContent).toBe("ada:1");
    click("button");
    await settle();
    expect(calls).toEqual(["go"]);
    expect(root.textContent).toBe("ada:2");
  });
});

// --- issue #2's patterns, written with the library as it is ------------------------------------

type DateRangeS = { checkIn: number | null; checkOut: number | null };
type GuestsS = { adults: number };
/** A slice of a store as a child takes it: a path to read, the handler that writes it. */
type Slice<S> = { at: Path<S>; set: Handler<[write: (draft: S) => void]> };

/** A deep module's state, given through a required context. */
const DateRangeCtx = createContext<Slice<DateRangeS>, "DateRangeCtx">(undefined, {
  name: "DateRangeCtx"
});
const DateRange = component(function* DateRange() {
  const range = yield* DateRangeCtx;
  const three = $event(function* () {
    yield* range.set(d => {
      d.checkIn = 1;
      d.checkOut = 4;
    });
  });
  const clear = $event(function* () {
    yield* range.set(d => {
      d.checkIn = null;
      d.checkOut = null;
    });
  });
  return view(function* () {
    return (
      <p class="range">
        {yield* range.at.checkIn}-{yield* range.at.checkOut}
        <button class="three" onClick={yield* three}>
          3
        </button>
        <button class="clear" onClick={yield* clear}>
          clear
        </button>
      </p>
    );
  });
});

/** A direct child takes its slice as two props: a path to read, a handler to write. */
const Guests = component(function* Guests(
  props: Props<{ guests: Source<GuestsS>; setGuests: Handler<[write: (d: GuestsS) => void]> }>
) {
  const add = $event(function* () {
    yield* props.setGuests(d => {
      d.adults++;
    });
  });
  return view(function* () {
    return (
      <p class="guests">
        {yield* props.guests.adults}
        <button class="add" onClick={yield* add}>
          +
        </button>
      </p>
    );
  });
});

/**
 * The container: a generator helper that creates, delegated to with `yield*`
 * so its creations are the page's — one `$store`, one setter `$event` per
 * slice.
 */
function* createBooking() {
  const [at, set] = yield* $store({
    dates: { checkIn: null, checkOut: null } as DateRangeS,
    guests: { adults: 1 } as GuestsS
  });
  const setDates = $event(function* (write: (d: DateRangeS) => void) {
    yield* set(b => {
      write(b.dates);
    });
  });
  const setGuests = $event(function* (write: (d: GuestsS) => void) {
    yield* set(b => {
      write(b.guests);
    });
  });
  return {
    at,
    set,
    dates: { at: at.dates, set: setDates } as Slice<DateRangeS>,
    guests: { at: at.guests, set: setGuests } as Slice<GuestsS>
  };
}

const BookingPage = component(function* BookingPage() {
  const booking = yield* createBooking();
  // cross-slice logic reads the slices' public state through the container's path
  const total = yield* $memo(function* () {
    const checkIn = yield* booking.at.dates.checkIn;
    const checkOut = yield* booking.at.dates.checkOut;
    const adults = yield* booking.at.guests.adults;
    return checkIn === null || checkOut === null ? 0 : (checkOut - checkIn) * adults * 100;
  });
  return view(function* () {
    return (
      <main>
        {
          yield* DateRangeCtx.provide({
            value: booking.dates,
            children: function* () {
              return (
                <>
                  {yield* DateRange()}
                  {yield* Guests({ guests: booking.guests.at, setGuests: booking.guests.set })}
                  <p class="total">{yield* total}</p>
                </>
              );
            }
          })
        }
      </main>
    );
  });
});

describe("D-118: a lens is a convention — createBooking, a context for the deep module, props for the direct one", () => {
  it("the booking page: DateRange through its context, Guests through two props, a total memo in the page", async () => {
    mount(BookingPage);
    const text = (s: string) => root.querySelector(s)!.textContent;
    expect(text(".total")).toBe("0");
    click(".three");
    await settle();
    expect(text(".range")).toMatch(/^1-4/);
    expect(text(".total")).toBe("300");
    click(".add");
    await settle();
    expect(text(".guests")).toMatch(/^2/);
    expect(text(".total")).toBe("600");
    click(".clear");
    await settle();
    expect(text(".total")).toBe("0");
  });

  it("each page owns its container: two pages, two stores", async () => {
    const Two = component(function* Two() {
      return view(function* () {
        return (
          <>
            {yield* BookingPage()}
            {yield* BookingPage()}
          </>
        );
      });
    });
    mount(Two);
    click(".add", 0);
    click(".three", 1);
    await settle();
    expect(texts(".guests")).toEqual(["2", "1"]);
    expect(texts(".total")).toEqual(["0", "300"]);
  });

  it("in h: h(Ctx.provide, { value: booking.dates }, …) gives the deep module its slice", async () => {
    const Page = component(function* Page() {
      const booking = yield* createBooking();
      return view(function* () {
        return h(
          "main",
          h(DateRangeCtx.provide, { value: booking.dates }, h(DateRange, {})),
          h(Guests, { guests: booking.guests.at, setGuests: booking.guests.set })
        );
      });
    });
    mount(() => h(Page, {}));
    click(".three");
    click(".add");
    await settle();
    expect(root.querySelector(".range")!.textContent).toMatch(/^1-4/);
    expect(root.querySelector(".guests")!.textContent).toMatch(/^2/);
  });
});

describe("D-118: a module that also works alone — a sentinel default, compared in the setup", () => {
  /** No provider: the default, held as it is. A defaulted context adds nothing to R. */
  const NONE = Symbol("no provider");
  const PickerCtx = createContext<Slice<DateRangeS> | typeof NONE>(NONE, { name: "PickerCtx" });
  const Picker = component(function* Picker() {
    const provided = yield* PickerCtx;
    // the provider's slice, else the module's own: holding and comparing a value is not a read
    let range: Slice<DateRangeS>;
    if (provided !== NONE) range = provided;
    else {
      const [at, setAt] = yield* $store<DateRangeS>({ checkIn: null, checkOut: null });
      range = {
        at,
        set: $event(function* (write: (d: DateRangeS) => void) {
          yield* setAt(d => {
            write(d);
          });
        })
      };
    }
    const pick = $event(function* () {
      yield* range.set(d => {
        d.checkIn = 5;
        d.checkOut = 6;
      });
    });
    return view(function* () {
      return (
        <span class="picker">
          {yield* range.at.checkIn}
          <button onClick={yield* pick}>pick</button>
        </span>
      );
    });
  });

  it("provider absent: each instance makes its own store", async () => {
    const Alone = component(function* Alone() {
      return view(function* () {
        return (
          <>
            {yield* Picker()}
            {yield* Picker()}
          </>
        );
      });
    });
    mount(Alone);
    click("button", 1);
    await settle();
    expect(texts(".picker")).toEqual(["", "5"]);
  });

  it("provider present: the page's slice, whose store the page owns; two providers, two slices", async () => {
    const Page = component(function* Page() {
      const booking = yield* createBooking();
      const [other] = yield* $store<DateRangeS>({ checkIn: null, checkOut: null });
      const otherSlice: Slice<DateRangeS> = {
        at: other,
        set: $event(function* () {})
      };
      return view(function* () {
        return (
          <>
            {
              yield* PickerCtx.provide({
                value: booking.dates,
                children: function* () {
                  return <>{yield* Picker()}</>;
                }
              })
            }
            {
              yield* PickerCtx.provide({
                value: otherSlice,
                children: function* () {
                  return <>{yield* Picker()}</>;
                }
              })
            }
            <b>{yield* booking.at.dates.checkIn}</b>
          </>
        );
      });
    });
    mount(Page);
    click("button", 0);
    await settle();
    expect(root.querySelector("b")!.textContent).toBe("5");
    expect(texts(".picker")).toEqual(["5", ""]);
  });
});
