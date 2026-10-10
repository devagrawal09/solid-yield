export function T1(props: { onChange: (v: boolean) => void }) {
  return <input type="checkbox" onChange={(e) => props.onChange(e.currentTarget.checked)} />;
}
