// D-131 reduction/control for mining gap 04. See origins.mjs.
import { createContext, useContext, type Accessor } from "solid-js";
import { render } from "@solidjs/web";
const Presented = createContext<Accessor<boolean>>(() => true);
function App() {
  const read = useContext(Presented);
  const initial = read();
  return <p>{initial ? "shown" : "hidden"}</p>;
}
render(App, document.body);
