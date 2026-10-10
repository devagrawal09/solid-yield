type Stats = { damage: number };
// A render-function prop called with arguments in the view.
export function StatLine(props: { left?: Stats; right?: Stats; valueFunc: (s?: Stats) => number | undefined }) {
  return (
    <div>
      <span>{props.valueFunc(props.left)}</span>
      <span>{props.valueFunc(props.right)}</span>
    </div>
  );
}
