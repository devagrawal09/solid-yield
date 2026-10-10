import { render } from "@solidjs/web";
function App(props: { title?: string }) {
  return <p>{props.title}</p>;
}
export function init(el: HTMLElement, { title }: { title?: string } = {}) {
  render(() => <App title={title} />, el);
}
