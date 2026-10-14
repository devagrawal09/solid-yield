import { getRequestEvent } from "@solidjs/web";
import { GET, live, dropAll } from "./fake-server-functions";

it("200 closed fake requests finish parked watchers and their pending reads", async () => {
  let active = 0;
  let finished = 0;
  const stream = GET(async function* () {
    const signal = getRequestEvent()!.request.signal;
    active++;
    try {
      yield 1;
      await new Promise<void>(resolve =>
        signal.addEventListener("abort", () => resolve(), { once: true })
      );
    } finally {
      active--;
      finished++;
    }
  });
  for (let round = 0; round < 200; round++) {
    const it = stream()[Symbol.asyncIterator]();
    expect(await it.next()).toEqual({ done: false, value: 1 });
    const pending = it.next();
    await it.return!();
    expect(await pending).toEqual({ done: true, value: undefined });
    await Promise.resolve();
    expect(active).toBe(0);
    expect(finished).toBe(round + 1);
    expect(dropAll()).toBe(0);
  }
});

it("live reconnect aborts its old request before opening another", async () => {
  let active = 0;
  const stream = live(
    GET(async function* () {
      const signal = getRequestEvent()!.request.signal;
      active++;
      try {
        yield 1;
        await new Promise<void>(resolve =>
          signal.addEventListener("abort", () => resolve(), { once: true })
        );
      } finally {
        active--;
      }
    })
  );
  const it = stream()[Symbol.asyncIterator]();
  expect(await it.next()).toEqual({ done: false, value: 1 });
  const pending = it.next();
  dropAll();
  expect(await pending).toEqual({ done: false, value: 1 });
  expect(active).toBe(1);
  await it.return!();
  await Promise.resolve();
  await Promise.resolve();
  expect(active).toBe(0);
  expect(dropAll()).toBe(0);
});
