import { createMemo, Loading } from "solid-js";
function Icon(props: { icon: string; class?: string }) {
  return <i class={`fas fa-${props.icon} ${props.class}`} />;
}
async function loadIcon() {
  return "bug";
}
export function Colored() {
  const name = createMemo(() => loadIcon());
  return (
    <Loading>
      <Icon icon={name()} />
    </Loading>
  );
}
export function Page() {
  return <Icon icon="bug" class="mr-1" />;
}
