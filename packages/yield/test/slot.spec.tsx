/**
 * D-118: references are held, never read, wherever they arrive. An `$event`
 * handler prop arrives in the child as itself; a slot's provided value
 * arrives raw in the setup; `compose` builds the path-and-handler
 * convention for several parts of one store. Views are written with
 * `yield*` in JSX (the transform's rule runs in this suite).
 */
import { createRoot, flush } from "solid-js";
import {
  $event,
  $memo,
  $slot,
  $store,
  component,
  compose,
  createSlot,
  render,
  view,
  type Handler,
  type Part,
  type Path,
  type Props
} from "solid-yield";
import { h } from "solid-yield/h";
import { bindEvent, holeOf } from "solid-yield/internal";

declare const __DEV__: boolean;
const devIt = __DEV__ ? it : it.skip;

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
const click = (selector: string) => root.querySelector<HTMLElement>(selector)!.click();

// --- the booking page of the issue (#2), on the convention ------------------------------------

type DateRangeS = { checkIn: number | null; checkOut: number | null };
type GuestsS = { adults: number };
/** A date range's slot carries its part: a path to read, the handler that writes it. */
const DateRangeState = createSlot<Part<DateRangeS>, "DateRangeState">({ name: "DateRangeState" });

const DateRange = component(function* DateRange() {
  const range = yield* $slot(DateRangeState);
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

/** Guests takes its part as two props: a path to read, a handler to write. */
const Guests = component(function* Guests(
  props: Props<{ guests: GuestsS; setGuests: Handler<[write: (d: GuestsS) => void]> }>
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

const Booking = compose({
  dates: { init: (): DateRangeS => ({ checkIn: null, checkOut: null }), slot: DateRangeState },
  guests: { init: (): GuestsS => ({ adults: 1 }) }
});

const BookingPage = component(function* BookingPage() {
  const booking = yield* Booking.$store();
  const { guests } = booking.parts;
  // cross-module logic reads the parts' public state through the container's path
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
          yield* Booking.provide({
            value: booking,
            children: function* () {
              return (
                <>
                  {yield* DateRange()}
                  {yield* Guests({ guests: guests.at, setGuests: guests.set })}
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

describe("D-118: an $event handler prop arrives as itself", () => {
  it("a child calls a parent's event prop with one yield*, and binds it with one", async () => {
    const calls: string[] = [];
    const Child = component(function* Child(props: Props<{ onClear: Handler<[why: string]> }>) {
      const viaEvent = $event(function* () {
        yield* props.onClear("event");
      });
      return view(function* () {
        return (
          <>
            <button class="bound" onClick={[yield* props.onClear, "bound"]}>
              bound
            </button>
            <button class="event" onClick={yield* viaEvent}>
              event
            </button>
          </>
        );
      });
    });
    let given: unknown;
    let received: unknown;
    const Probe = component(function* Probe(props: Props<{ onClear: Handler<[why: string]> }>) {
      received = props.onClear;
      return view(function* () {
        return <i />;
      });
    });
    const Parent = component(function* Parent() {
      const clear = $event(function* (why: string) {
        calls.push(why);
      });
      given = clear;
      return view(function* () {
        return (
          <>
            {yield* Child({ onClear: clear })}
            {yield* Probe({ onClear: clear })}
          </>
        );
      });
    });
    mount(Parent);
    // held in the setup, not read: the handler itself
    expect(received).toBe(given);
    click(".bound");
    click(".event");
    await settle();
    expect(calls).toEqual(["bound", "event"]);
  });

  it("in h, a component's $event prop arrives as itself too (Solid's h would call it where it is read)", async () => {
    let calls = 0;
    const Child = component(function* Child(props: Props<{ onClear: Handler }>) {
      const go = $event(function* () {
        yield* props.onClear();
      });
      return view(function* () {
        return h("button", { onClick: go }, "x");
      });
    });
    const Parent = component(function* Parent() {
      const clear = $event(function* () {
        calls++;
      });
      return view(function* () {
        return h(Child, { onClear: clear });
      });
    });
    mount(() => h(Parent, {}));
    expect(calls).toBe(0);
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

describe("D-118: state slots", () => {
  devIt("the required form with no provider above is NO_PROVIDER at the read, naming the reader and the slot", () => {
    expect(() => createRoot(() => DateRange())).toThrow(
      /\[NO_PROVIDER\] <DateRange> reads the slot DateRangeState/
    );
  });

  it("the required form with a provider gives its value raw: the same object, not a path", () => {
    let held: unknown;
    const Reader = component(function* Reader() {
      held = yield* $slot(DateRangeState);
      return view(function* () {
        return <i />;
      });
    });
    let part: unknown;
    const App = component(function* App() {
      const [at, setAt] = yield* $store<DateRangeS>({ checkIn: 2, checkOut: 3 });
      const value: Part<DateRangeS> = {
        at,
        set: $event(function* (write: (d: DateRangeS) => void) {
          yield* setAt(d => {
            write(d);
          });
        })
      };
      part = value;
      return view(function* () {
        return (
          <>
            {yield* DateRangeState.provide({
              value,
              children: function* () {
                return <>{yield* Reader()}</>;
              }
            })}
          </>
        );
      });
    });
    mount(App);
    expect(held).toBe(part);
  });

  it("two providers for two instances: each module writes its own part", async () => {
    const Twice = compose({
      outbound: { init: (): DateRangeS => ({ checkIn: null, checkOut: null }), slot: DateRangeState },
      inbound: { init: (): DateRangeS => ({ checkIn: null, checkOut: null }) }
    });
    const Page = component(function* Page() {
      const trip = yield* Twice.$store();
      return view(function* () {
        return (
          <>
            <div class="a">
              {yield* DateRangeState.provide({
                value: trip.parts.outbound,
                children: function* () {
                  return <>{yield* DateRange()}</>;
                }
              })}
            </div>
            <div class="b">
              {yield* DateRangeState.provide({
                value: trip.parts.inbound,
                children: function* () {
                  return <>{yield* DateRange()}</>;
                }
              })}
            </div>
            <p class="whole">
              {yield* trip.at.outbound.checkOut}/{yield* trip.at.inbound.checkOut}
            </p>
          </>
        );
      });
    });
    mount(Page);
    expect(root.querySelector(".whole")!.textContent).toBe("/");
    click(".b .three");
    await settle();
    expect(root.querySelector(".a .range")!.textContent).toMatch(/^-/);
    expect(root.querySelector(".b .range")!.textContent).toMatch(/^1-4/);
    expect(root.querySelector(".whole")!.textContent).toBe("/4");
  });

  it("the init form: the provider's value when there is one, else what the init routine makes, per instance", async () => {
    const Picker = component(function* Picker() {
      const range = yield* $slot(DateRangeState, {
        init: function* () {
          const [at, setAt] = yield* $store<DateRangeS>({ checkIn: null, checkOut: null });
          return {
            at,
            set: $event(function* (write: (d: DateRangeS) => void) {
              yield* setAt(d => {
                write(d);
              });
            })
          };
        }
      });
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
    // standalone: two instances, two local stores
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
    root.querySelectorAll("button")[1]!.click();
    await settle();
    expect([...root.querySelectorAll(".picker")].map(p => p.firstChild!.textContent)).toEqual([
      "",
      "5"
    ]);
    dispose?.();
    root.textContent = "";
    // under a provider: its part, whose store the page owns
    const Provided = compose({
      dates: { init: (): DateRangeS => ({ checkIn: null, checkOut: null }), slot: DateRangeState }
    });
    const Page = component(function* Page() {
      const page = yield* Provided.$store();
      return view(function* () {
        return (
          <>
            {yield* Provided.provide({
              value: page,
              children: function* () {
                return <>{yield* Picker()}</>;
              }
            })}
            <b>{yield* page.at.dates.checkIn}</b>
          </>
        );
      });
    });
    mount(Page);
    click("button");
    await settle();
    expect(root.querySelector("b")!.textContent).toBe("5");
  });

  devIt("$slot outside a setup: CONTEXT_OUTSIDE_SETUP, the init form CREATE_OUTSIDE_SETUP", () => {
    expect(() =>
      createRoot(() =>
        holeOf(function* () {
          return yield* $slot(DateRangeState);
        })()
      )
    ).toThrow(/CONTEXT_OUTSIDE_SETUP/);
    expect(() =>
      createRoot(() =>
        holeOf(function* () {
          return yield* $slot(DateRangeState, {
            init: function* () {
              return null as unknown as Part<DateRangeS>;
            }
          });
        })()
      )
    ).toThrow(/CREATE_OUTSIDE_SETUP/);
  });

  devIt("yield* Slot is not a read: SLOT_READ", () => {
    const Wrong = component(function* Wrong() {
      yield* DateRangeState as any;
      return view(function* () {
        return <i />;
      });
    });
    expect(() => createRoot(() => Wrong())).toThrow(/SLOT_READ\] the slot DateRangeState/);
  });
});

describe("D-118: compose", () => {
  it("the booking page: DateRange through its slot, Guests through two props, a total memo in the page", async () => {
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

  it("each page owns its container: two pages, two stores (every entry's init runs per instance)", async () => {
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
    root.querySelectorAll<HTMLElement>(".add")[0]!.click();
    await settle();
    expect([...root.querySelectorAll(".guests")].map(g => g.firstChild!.textContent)).toEqual([
      "2",
      "1"
    ]);
  });

  it("in h: h(Schema.provide, { value }, …) provides each slot", async () => {
    const Page = component(function* Page() {
      const booking = yield* Booking.$store();
      return view(function* () {
        return h("main", h(Booking.provide, { value: booking }, h(DateRange, {})));
      });
    });
    mount(() => h(Page, {}));
    click(".three");
    await settle();
    expect(root.querySelector(".range")!.textContent).toMatch(/^1-4/);
  });

  it("a part's path is the container's at the key", () => {
    let paths: [Path<DateRangeS>, Path<DateRangeS>] | undefined;
    const Page = component(function* Page() {
      const booking = yield* Booking.$store();
      paths = [booking.parts.dates.at, booking.at.dates];
      return view(function* () {
        return <i />;
      });
    });
    mount(Page);
    expect(String(paths![0])).toBe(String(paths![1]));
    expect(String(paths![0])).toBe("[path .dates]");
  });
});
