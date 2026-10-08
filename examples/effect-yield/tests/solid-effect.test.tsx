import { Effect } from "effect";
import { createRoot } from "solid-js";
import { runEffect } from "../src/solid-effect";

const iterator = <A,>(program: Effect.Effect<A>) =>
  createRoot(dispose => {
    const it = runEffect(program)[Symbol.asyncIterator]();
    dispose();
    return it;
  });

it("settled Effect iterators deliver once and close safely", async () => {
  const it = iterator(Effect.succeed(42));
  expect(await it.next()).toEqual({ done: false, value: 42 });
  expect(await it.return!()).toEqual({ done: true, value: undefined });
  expect(await it.next()).toEqual({ done: true, value: undefined });
});

it("closing a pending Effect iterator interrupts its program and completes its pending read", async () => {
  let finalized = false;
  const it = iterator(
    Effect.never.pipe(
      Effect.ensuring(
        Effect.sync(() => {
          finalized = true;
        })
      )
    )
  );
  const pending = it.next();
  await it.return!();
  expect(await pending).toEqual({ done: true, value: undefined });
  expect(finalized).toBe(true);
});

it("failed Effect iterators preserve the error and close safely", async () => {
  const error = new Error("failed search");
  const it = createRoot(dispose => {
    const it = runEffect(Effect.fail(error))[Symbol.asyncIterator]();
    dispose();
    return it;
  });
  await expect(it.next()).rejects.toBe(error);
  expect(await it.return!()).toEqual({ done: true, value: undefined });
  expect(await it.next()).toEqual({ done: true, value: undefined });
});
