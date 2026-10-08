import { createMemo } from "solid-js";
import { render } from "@solidjs/web";
function App() {
  const count = createMemo(async () => 1);
  return <p>{count()}</p>;
}
render(App, document.body);
