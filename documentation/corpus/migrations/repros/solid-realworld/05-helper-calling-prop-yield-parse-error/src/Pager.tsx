export function Pager(props: { onSetPage: (page: number) => void }) {
  const handlePage = (v: number, e: MouseEvent) => {
    e.preventDefault();
    props.onSetPage(v);
  };
  return <a href="" onClick={e => handlePage(2, e)}>next</a>;
}
