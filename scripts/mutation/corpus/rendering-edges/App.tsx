import { lazy, Show } from "solid-js";
import { Link, useRouter, withRouter } from "./router";

// D-119 through lazy: a native page loaded on demand.
const Feed = lazy(() => import("./Feed"));

// F-S51: an inline component given to the factory.
const App = withRouter(() => {
  const [path] = useRouter();
  return (
    <>
      <nav>
        <Link to="/" label="home" />
        <Link to="/feed" label="feed" />
      </nav>
      <Show when={path() === "/feed"} fallback={<p>home</p>}>
        <Feed />
      </Show>
    </>
  );
});

export default App;
