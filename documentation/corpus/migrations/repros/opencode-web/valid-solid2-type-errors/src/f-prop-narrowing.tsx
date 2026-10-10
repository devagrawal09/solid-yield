type Msg = { role: "user" } | { role: "assistant"; error?: { message: string } };
// Discriminant narrowing on a prop, through a local alias.
export function F(props: { info: Msg }) {
  const error = () => {
    const info = props.info;
    return info.role === "assistant" ? info.error?.message : undefined;
  };
  return <p>{error()}</p>;
}
