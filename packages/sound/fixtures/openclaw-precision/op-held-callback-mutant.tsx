function Leaf(props: { onChange: () => void }) { return <button onClick={() => props.onChange()}>change</button>; }
function Middle(props: { onChange: () => void }) { return <Leaf onChange={props.onChange} />; }
export function App() {
  const safe = () => { throw new RangeError("change"); };
  return <Middle onChange={safe} />;
}
