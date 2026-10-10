export function Icon(props: { icon: string; class?: string; title?: string }) {
  return <i class={`fas fa-${props.icon} ${props.class}`} title={props.title} />;
}
