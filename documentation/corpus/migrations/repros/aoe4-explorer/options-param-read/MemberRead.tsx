import { render } from "@solidjs/web";
function App(props: { title?: string }) {
  return <p>{props.title}</p>;
}
export function init(el: HTMLElement, options: { title?: string } = {}) {
  const title = options.title;
  render(() => <App title={title} />, el);
}
