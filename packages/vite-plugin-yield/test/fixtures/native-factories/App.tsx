import { Show } from "solid-js";
import { RouteHOC, useRouter } from "./router";
const App = RouteHOC(() => {
  const [location, { matches, setLocation }] = useRouter();
  return (
    <nav class={matches("index") ? "home" : ""} onClick={() => setLocation("profile")}>
      {location()}
    </nav>
  );
});
export default App;
