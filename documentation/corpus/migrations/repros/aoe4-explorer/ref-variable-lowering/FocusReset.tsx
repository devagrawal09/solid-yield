import { createEffect, createSignal } from "solid-js";
// The documented Solid ref form: a bare `let` assigned by `ref={el}`, used later in an effect phase.
export function FocusReset() {
  const [page, setPage] = createSignal(0);
  let el: HTMLDivElement | undefined;
  createEffect(
    () => page(),
    () => {
      if (el) el.focus();
    }
  );
  return (
    <div ref={el} tabindex="-1" onClick={() => setPage(page() + 1)}>
      page {page()}
    </div>
  );
}
