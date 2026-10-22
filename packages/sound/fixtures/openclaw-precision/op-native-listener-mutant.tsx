export function App(props: { target?: { removeEventListener(type: string, listener: EventListener): void } }) {
  const listener: EventListener = () => {};
  const target = props.target ?? document;
  return <button onClick={() => target.removeEventListener("click", listener)}>stop</button>;
}
