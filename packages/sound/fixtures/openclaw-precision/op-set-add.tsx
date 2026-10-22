export function App(props: { children?: { add(value: string): unknown } }) {
  const children = new Set<string>();
  return <button onClick={() => { children.add("overlay"); }}>add</button>;
}
