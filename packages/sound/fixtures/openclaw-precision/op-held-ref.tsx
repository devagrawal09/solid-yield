function Leaf(props: { errorRef: (node: HTMLInputElement) => void }) { return <input ref={(node) => props.errorRef(node)} />; }
function Middle(props: { errorRef: (node: HTMLInputElement) => void }) { return <Leaf errorRef={props.errorRef} />; }
export function App() {
  let input: HTMLInputElement | undefined;
  const capture = (node: HTMLInputElement) => { input = node; };
  return <Middle errorRef={capture} />;
}
