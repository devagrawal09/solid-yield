function formatMessage(n: number) {
  if (n < 0) return null;
  return <b>{n}</b>;
}
export function P15(props: { n: number }) {
  return <div>{formatMessage(props.n)}</div>;
}
