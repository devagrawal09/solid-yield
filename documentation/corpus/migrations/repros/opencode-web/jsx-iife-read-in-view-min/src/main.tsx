import { createSignal } from "solid-js";
import { render } from "@solidjs/web";

type Info = { model: string; cost: number };

// A footer built by an immediately invoked function inside a JSX hole: valid Solid 2.
function Footer(props: { info: Info }) {
  return (
    <footer id="footer">
      {(() => {
        const parts: string[] = [props.info.model];
        parts.push(`$${props.info.cost.toFixed(4)}`);
        return parts.join(" • ");
      })()}
    </footer>
  );
}

function App() {
  const [info, setInfo] = createSignal<Info>({ model: "model-a", cost: 0.0123 });
  return (
    <div>
      <Footer info={info()} />
      <button id="bump" onClick={() => setInfo({ model: "model-a", cost: 1 })}>bump</button>
    </div>
  );
}

render(() => <App />, document.getElementById("root")!);
