export function App(props: { children?: { add(value: string): unknown } }) {
  const children = props.children ?? new Set<string>();
  return <button onClick={() => { children.add("overlay"); }}>add</button>;
}
