import { createSignal, flush, NotReadyError } from "solid-js";
import {
  attempt,
  component,
  $memo,
  $event,
  Errored,
  foreignSource,
  Loading,
  render,
  view
} from "solid-yield";
import { Failed } from "./failed.js";

it("Q5: tracks the getter, maps failures at the read, and keeps the public source guarded", () => {
  const [value, setValue] = createSignal(1);
  const source = foreignSource(() => {
    const n = value();
    if (n < 0) throw new Error("foreign failure");
    return n;
  });
  const C = component(function* () {
    const mapped = yield* $memo(function* () {
      return yield* attempt(
        () => source,
        cause => new Failed(cause)
      );
    });
    return view(function* () {
      return (
        <>
          {
            yield* Errored({
              catch: [Failed],
              fallback: err => <b>{err().kind}</b>,
              children: function* () {
                return (
                  <>
                    {
                      yield* Loading({
                        children: function* () {
                          return <p>{yield* mapped}</p>;
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
  const el = document.createElement("div");
  const dispose = render(C, el);
  expect(el.textContent).toBe("1");
  setValue(2);
  flush();
  expect(el.textContent).toBe("2");
  setValue(-1);
  flush();
  expect(el.textContent).toBe("failed");
  dispose();
  expect(() => source[Symbol.iterator]().next()).toThrow("FOREIGN_SOURCE_ATTEMPT");
});

it("Q5: pending passes the mapper and remains pending", () => {
  let mapped = false;
  const source = foreignSource(() => {
    throw new NotReadyError(Promise.resolve());
  });
  const read = attempt(
    () => source,
    cause => {
      mapped = true;
      return new Failed(cause);
    }
  );
  expect(() => read[Symbol.iterator]().next()).toThrow(NotReadyError);
  expect(mapped).toBe(false);
});

it("Q5: an event maps a foreign failure as a branded event failure", async () => {
  const source = foreignSource(() => {
    throw new Error("foreign");
  });
  const read = $event(function* () {
    return yield* attempt(
      () => source,
      cause => new Failed(cause)
    );
  });
  const caller = $event(function* () {
    return yield* attempt(
      () => read(),
      cause => cause.kind
    );
  });
  await expect(caller()).resolves.toBe("failed");
});
