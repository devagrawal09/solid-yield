import { render } from "@solidjs/web";
function App() {
  return <p>app</p>;
}
export function init(el: HTMLElement) {
  render(() => <App />, el);
}
