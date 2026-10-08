import { createContext, useContext } from "solid-js";
import { render } from "@solidjs/web";
const Identity = createContext<string>();
function App() {
  const name = useContext(Identity);
  return <p>{name}</p>;
}
render(App, document.body);
