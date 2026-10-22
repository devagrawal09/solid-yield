export function App(props: { eligible?: (button: HTMLButtonElement) => boolean; remove?: () => boolean; destinations?: () => Array<HTMLButtonElement | undefined> }) {
  let button!: HTMLButtonElement;
  const repair = () => {
    let destinations: Array<HTMLButtonElement | undefined> = [button];
    try {
      if (props.remove && !props.remove()) return;
      if (props.destinations) destinations = props.destinations();
    } catch { return; }
    queueMicrotask(() => {
      if (document.activeElement === document.body) {
        destinations.find((node) => node && props.eligible?.(node))?.focus();
      }
    });
  };
  return <button ref={(node) => { button = node; }} onClick={repair}>repair</button>;
}
