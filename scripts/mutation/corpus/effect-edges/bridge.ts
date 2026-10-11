import { action } from "solid-js";

// A saga driver (Effect's effectAction, without Effect): each yielded promise
// is one step inside the action, resumed with its value.
export function drive<A extends unknown[], R>(
  steps: (...args: A) => Generator<Promise<number>, R, number>
) {
  const base = action(function* (...args: A) {
    const it = steps(...args);
    let step = it.next(0);
    while (!step.done) {
      const value = (yield step.value) as number;
      step = it.next(value);
    }
    return step.value;
  });
  const invoke = (...args: A) => base(...args);
  invoke.label = "saga";
  return invoke;
}
