export function Content(props) {
  return (
    <article data-page={props.slug}>
      <div
        class="raw"
        innerHTML={`<a href="/page/a">Raw A</a><a href="/page/b">Raw B</a><a href="#part">Raw Part</a>`}
      />
      <a class="authored" href={`/page/${props.slug}`}>
        Authored
      </a>
      <a class="part" href="#part">
        Part
      </a>
      <h2 id="part">Part {props.slug}</h2>
    </article>
  );
}
