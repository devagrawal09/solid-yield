import { render } from "@solidjs/web";
import { Counter } from "./Counter";
import Label from "./Label";

function App() {
  return <Label class="x"><Counter label="clicks" /></Label>;
}
render(() => <App />, document.body);
