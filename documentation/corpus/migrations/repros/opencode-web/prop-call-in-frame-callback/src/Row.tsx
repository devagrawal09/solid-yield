import { onSettled } from "solid-js";

// opencode-web ChatView Row shape (after hoisting Row to module level, as NATIVE_COMPONENT asks):
// a function prop called from requestAnimationFrame / ResizeObserver callbacks inside onSettled.
export function Row(props: { measure: (el: HTMLElement) => void; label: string }) {
  let el: HTMLDivElement | undefined;
  onSettled(() => {
    requestAnimationFrame(() => {
      if (el) props.measure(el);
    });
    const ro = new ResizeObserver(() => {
      if (el) props.measure(el);
    });
    if (el) ro.observe(el);
    return () => ro.disconnect();
  });
  return <div ref={(e) => (el = e)}>{props.label}</div>;
}
