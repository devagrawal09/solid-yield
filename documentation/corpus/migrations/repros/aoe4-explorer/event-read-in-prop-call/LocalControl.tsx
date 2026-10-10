export function T5(props: { onChange: (v: boolean) => void }) {
  return <input type="checkbox" onChange={(e) => { const v = e.currentTarget.checked; props.onChange(v); }} />;
}
