// Action path: a cancellable checkout saga — examples/effect's checkout with
// solid-yield.
//
// `placeOrder` is unchanged: a Solid action whose steps are Effect programs
// (its `yield*` delegates Effects to the saga driver; it is not a routine).
// The optimistic phase and the optimistic orders store are Solid primitives
// created in the setup and read through `read` / `paths`; the cart, the
// notice and the decline toggle are routine state.
import {
  component,
  $event,
  $memo,
  $signal,
  $store,
  $optimistic,
  $optimisticStore,
  attempt,
  For,
  Errored,
  Loading,
  readStore,
  refresh,
  Show,
  type Source,
  type Props,
  view
} from "solid-yield";
import {
  CardDeclinedError,
  chargeCard,
  createOrder,
  fetchOrders,
  refundCharge,
  releaseReservation,
  reserveInventory,
  type CartItem,
  type Charge,
  type Order,
  type Reservation
} from "./api";
import { ActionInterruptedError, effectAction } from "./solid-effect";

type Phase = "idle" | "reserving" | "charging" | "finalizing";

interface Notice {
  kind: "success" | "error" | "info";
  text: string;
}

const STEPS: { phase: Phase; label: string }[] = [
  { phase: "reserving", label: "Reserve inventory" },
  { phase: "charging", label: "Charge card" },
  { phase: "finalizing", label: "Create order" }
];

const INITIAL_CART: CartItem[] = [
  { id: "sku_signal", name: "Signal (fine-grained)", price: 19.99, quantity: 1 },
  { id: "sku_fiber", name: "Fiber (interruptible)", price: 24.5, quantity: 2 },
  { id: "sku_boundary", name: "Boundary (loading)", price: 9.75, quantity: 1 }
];

/**
 * The orders list. In the original it sits inside the checkout's
 * `<Loading>`; a view that reads a pending source is pending itself, so the
 * list is its own component and the boundary receives it.
 */
const Orders = component(function* Orders(
  props: Props<{ orders: Source<Order[], OrdersError, true> }>
) {
  return view(function* () {
    return (
      <>
        {
          yield* Show({
            when: function* () {
              return (yield* props.orders.length) > 0;
            },
            fallback: <p class="empty">No orders yet.</p>,
            children: function* () {
              return (
                <ul class="orders">
                  {
                    yield* For({
                      each: props.orders,
                      children: function* (order) {
                        return view(function* () {
                          return (
                            <li>
                              <span class="pkg-name">{yield* order.id}</span>
                              <span class="pkg-desc">
                                {yield* order.items.length} line
                                {(yield* order.items.length) === 1 ? "" : "s"} · placed{" "}
                                {yield* order.placedAt}
                              </span>
                              <span class="cart-price">${(yield* order.total).toFixed(2)}</span>
                            </li>
                          );
                        });
                      }
                    })
                  }
                </ul>
              );
            }
          })
        }
      </>
    );
  });
});

/** Fetching the orders failed: the color of the orders list's failure. */
export class OrdersError extends Error {
  readonly kind = "orders" as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

export const Checkout = component(function* Checkout() {
  const [cart, setCart] = yield* $store<CartItem[]>(INITIAL_CART.map(i => ({ ...i })));
  // The optimistic orders store fetches asynchronously: pending until the
  // first fetch lands, and failing as an OrdersError.
  const [orders] = yield* $optimisticStore(function* () {
    return yield* attempt(
      () => fetchOrders(),
      cause => new OrdersError(cause)
    );
  }, [] as Order[]);

  // Transition-scoped: writes inside the action revert automatically when it
  // settles — success, failure, or cancellation.
  const [phase, setPhase] = yield* $optimistic<Phase>("idle");
  // Plain signal: survives the optimistic revert, carries the outcome.
  const [notice, setNotice] = yield* $signal<Notice | null>(null);
  const [declineCard, setDeclineCard] = yield* $signal(false);

  const total = yield* $memo(function* () {
    return yield* readStore(cart, c =>
      c.reduce((sum, item) => sum + item.price * item.quantity, 0)
    );
  });

  const placeOrder = effectAction(function* (items: CartItem[], decline: boolean) {
    let reservation: Reservation | undefined;
    let charge: Charge | undefined;
    yield* setNotice(null);
    try {
      yield* setPhase("reserving");
      reservation = yield* reserveInventory(items);
      yield* setPhase("charging");
      charge = yield* chargeCard(
        items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        decline
      );
      yield* setPhase("finalizing");
      const order = yield* createOrder(items, reservation, charge);
      yield* setNotice({
        kind: "success",
        text: `Order ${order.id} confirmed — $${order.total.toFixed(2)}`
      });
      yield* refresh(orders);
      return order;
    } catch (e) {
      // Saga compensation, in reverse order of what committed. Mid-step
      // cleanup (voiding a half-done authorization) already ran via the
      // interrupted step's own finalizers.
      if (charge) yield* refundCharge(charge);
      if (reservation) yield* releaseReservation(reservation);
      if (e instanceof CardDeclinedError) {
        yield* setNotice({
          kind: "error",
          text: `Card declined for $${e.amount.toFixed(2)} — refunds/releases applied, cart untouched`
        });
      } else if (e instanceof ActionInterruptedError) {
        yield* setNotice({
          kind: "info",
          text: "Checkout cancelled — compensations ran, cart untouched"
        });
      }
      throw e; // reject the action → optimistic phase reverts to "idle"
    }
  });

  const inFlight = yield* $memo(function* () {
    return (yield* phase) !== "idle";
  });
  const place = $event(function* () {
    const items = yield* readStore(cart, c => c.map(item => ({ ...item })));
    try {
      yield* placeOrder(items, yield* declineCard);
    } catch {
      // the saga set the notice; its failure ends here
    }
  });
  const cancel = $event(function* () {
    placeOrder.interrupt();
  });
  const toggleDecline = $event(function* (e: InputEvent & { currentTarget: HTMLInputElement }) {
    yield* setDeclineCard(e.currentTarget.checked);
  });

  return view(function* () {
    return (
      <section class="panel">
        <header>
          <h2>Checkout saga</h2>
          <p>
            Three Effect steps inside one Solid action transaction. Cancel mid-charge (it takes
            ~2.6s) or toggle the decline: the fiber is interrupted, compensations run server-side,
            and the optimistic UI reverts — automatically on both sides.
          </p>
        </header>

        <div class="cart">
          {
            yield* For({
              each: cart,
              children: function* (item, i) {
                const decrement = $event(function* () {
                  const index = yield* i;
                  yield* setCart(c => {
                    c[index].quantity--;
                  });
                });
                const increment = $event(function* () {
                  const index = yield* i;
                  yield* setCart(c => {
                    c[index].quantity++;
                  });
                });
                return view(function* () {
                  return (
                    <div class="cart-row">
                      <span class="cart-name">{yield* item.name}</span>
                      <span class="qty">
                        <button
                          disabled={(yield* inFlight) || (yield* item.quantity) <= 1}
                          onClick={decrement}
                        >
                          −
                        </button>
                        {yield* item.quantity}
                        <button disabled={yield* inFlight} onClick={increment}>
                          +
                        </button>
                      </span>
                      <span class="cart-price">
                        ${((yield* item.price) * (yield* item.quantity)).toFixed(2)}
                      </span>
                    </div>
                  );
                });
              }
            })
          }
          <div class="cart-row total">
            <span class="cart-name">Total</span>
            <span class="cart-price">${(yield* total).toFixed(2)}</span>
          </div>
        </div>

        <div class="checkout-controls">
          <label class="decline-toggle">
            <input type="checkbox" checked={yield* declineCard} onInput={toggleDecline} />
            Simulate card decline (typed <code>CardDeclinedError</code>)
          </label>
          {
            yield* Show({
              when: inFlight,
              fallback: function* () {
                return (
                  <button class="primary" onClick={place}>
                    Place order — ${(yield* total).toFixed(2)}
                  </button>
                );
              },
              children: function* () {
                return (
                  <button class="danger" onClick={cancel}>
                    Cancel checkout
                  </button>
                );
              }
            })
          }
        </div>

        <ol class="steps">
          {
            yield* For({
              each: STEPS,
              children: function* (step) {
                const state = yield* $memo(function* () {
                  const order: Phase[] = ["reserving", "charging", "finalizing"];
                  const current = order.indexOf(yield* phase);
                  const target = order.indexOf(yield* step.phase);
                  if (current === -1) return "";
                  return target < current ? "done" : target === current ? "active" : "";
                });
                return view(function* () {
                  return (
                    <li
                      class={{
                        done: (yield* state) === "done",
                        active: (yield* state) === "active"
                      }}
                    >
                      {yield* step.label}
                    </li>
                  );
                });
              }
            })
          }
        </ol>

        {
          yield* Show({
            when: notice,
            children: function* (n) {
              return view(function* () {
                return <p class={`notice ${yield* n.kind}`}>{yield* n.text}</p>;
              });
            }
          })
        }

        <h3>Your orders</h3>
        {
          yield* Errored({
            fallback: err => <p class="error">Could not load orders: {err().message}</p>,
            children: function* () {
              return (
                <>
                  {
                    yield* Loading({
                      fallback: <p class="loading">Loading orders…</p>,
                      children: function* () {
                        return <>{yield* Orders({ orders })}</>;
                      }
                    })
                  }
                </>
              );
            }
          })
        }
      </section>
    );
  });
});
