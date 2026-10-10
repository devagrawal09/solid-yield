export function Preview(props: { title: string; onFav: (title: string, e: MouseEvent) => void }) {
  return <button onClick={e => props.onFav(props.title, e)}>fav</button>;
}
