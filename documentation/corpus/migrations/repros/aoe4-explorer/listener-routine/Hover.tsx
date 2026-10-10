import { createSignal, onSettled, Show } from "solid-js";
export function Hover(props: { target?: HTMLElement }) {
  const [hover, setHover] = createSignal(false);
  const onEnter = () => setHover(true);
  const onLeave = () => setHover(false);
  onSettled(() => {
    const el = props.target;
    el?.addEventListener("mouseenter", onEnter);
    el?.addEventListener("mouseleave", onLeave);
    return () => {
      el?.removeEventListener("mouseenter", onEnter);
      el?.removeEventListener("mouseleave", onLeave);
    };
  });
  return <Show when={hover()}><p>tip</p></Show>;
}
