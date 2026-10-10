import { createSignal } from "solid-js";

// Solid's ref-assignment form: `let el; <div ref={el}>` assigns the element to `el`.
export function Box() {
  let scrollRef: HTMLDivElement | undefined;
  const [top, setTop] = createSignal(0);
  const onScroll = () => setTop(scrollRef ? scrollRef.scrollTop : 0);
  return (
    <div ref={scrollRef} onScroll={onScroll}>
      {top()}
    </div>
  );
}
