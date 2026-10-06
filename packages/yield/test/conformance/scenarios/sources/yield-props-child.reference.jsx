import { h } from "conformance";
export let setLabel, setOther;
function Child(props) {
  h.run("child setup");
  return <span class="child">{props.label()}</span>;
}
export function App() {
  h.run("app setup");
  const [label, sl] = h.signal("label", "a");
  const [other, so] = h.signal("other", 0);
  setLabel = sl;
  setOther = so;
  return (
    <div>
      <Child label={label} />
      <i>{other()}</i>
    </div>
  );
}
