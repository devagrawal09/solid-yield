import {
  createSignal,
  createOptimistic,
  createMemo,
  createEffect,
  action,
  Loading,
  Errored,
  For
} from "solid-js";
import { search, like, subscribe, comments, avatar } from "./api";
import { SearchError, RateLimited, BadEmail } from "./errors";
export function ThemeToggle() {
  const [dark, setDark] = createSignal(false);
  createEffect(
    () => dark(),
    () => {}
  );
  return (
    <section class={dark() ? "widget theme dark" : "widget theme"}>
      <button onClick={() => setDark(!dark())}>Theme: {dark() ? "dark" : "light"}</button>
    </section>
  );
}
export function SearchBox() {
  const [query, setQuery] = createSignal("");
  const results = createMemo(() => search(query()));
  return (
    <section class="widget search">
      <h2>Search</h2>
      <input
        aria-label="Search docs"
        value={query()}
        onInput={e => setQuery(e.currentTarget.value)}
      />
      <Errored
        fallback={err => (
          <p class="search-error">
            {(err() as SearchError).kind}: {(err() as SearchError).message}
          </p>
        )}
      >
        <Loading fallback="Searching…">
          <ul>
            <For each={results()}>
              {link => (
                <li>
                  <a href={link.href}>{link.title}</a>
                </li>
              )}
            </For>
          </ul>
        </Loading>
      </Errored>
    </section>
  );
}
export function LikeButton(props: { slug: string | undefined }) {
  const [count, setCount] = createSignal(0);
  const [optimistic, setOptimistic] = createOptimistic(0);
  const [pending, setPending] = createOptimistic(false);
  const [failure, setFailure] = createSignal<RateLimited | null>(null);
  const add = action(function* () {
    const next = count() + 1;
    setOptimistic(1);
    setPending(true);
    try {
      const saved: number = yield like(props.slug ?? "overview", next);
      setCount(saved);
      setFailure(null);
    } catch (cause) {
      setFailure(new RateLimited(cause));
    }
  });
  return (
    <section class="widget like">
      <button disabled={pending()} onClick={add}>
        Like: {count() + optimistic()}
      </button>
      <span>{pending() ? " Saving…" : ""}</span>
      <p class="like-error">
        {failure()?.kind ?? ""}
        {failure() ? ": " : ""}
        {failure()?.message ?? ""}
      </p>
    </section>
  );
}
export function NewsletterForm() {
  const [email, setEmail] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [failure, setFailure] = createSignal<BadEmail | null>(null);
  const [pending, setPending] = createOptimistic(false);
  const submit = action(function* (e: SubmitEvent) {
    e.preventDefault();
    const value = email();
    setPending(true);
    try {
      const saved: string = yield subscribe(value);
      setMessage(saved);
      setFailure(null);
    } catch (cause) {
      setFailure(new BadEmail(cause));
      setMessage("");
    }
  });
  return (
    <form class="widget newsletter" novalidate onSubmit={submit}>
      <h2>Newsletter</h2>
      <input
        name="email"
        aria-label="Email"
        value={email()}
        onInput={e => setEmail(e.currentTarget.value)}
      />
      <button disabled={pending()}>{pending() ? "Subscribing…" : "Subscribe"}</button>
      <p class="newsletter-message">{message()}</p>
      <p class="newsletter-error">
        {failure()?.kind ?? ""}
        {failure() ? ": " : ""}
        {failure()?.message ?? ""}
      </p>
    </form>
  );
}
export function CommentList() {
  const rows = createMemo(() => comments());
  return (
    <section class="widget comments">
      <h2>Reader notes</h2>
      <Loading fallback="Loading comments…">
        <ul>
          <For each={rows()}>
            {row => {
              const picture = createMemo(() => avatar(row.id));
              return (
                <li>
                  <Loading fallback={<span class="avatar-pending">Avatar…</span>}>
                    <img width="24" height="24" alt="" src={picture()} />
                  </Loading>
                  <b>{row.name}</b>
                  <p>{row.text}</p>
                </li>
              );
            }}
          </For>
        </ul>
      </Loading>
    </section>
  );
}
const pictures = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Crect width='120' height='60' fill='teal'/%3E%3C/svg%3E",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Crect width='120' height='60' fill='coral'/%3E%3C/svg%3E"
];
export function ImageCarousel() {
  const [index, setIndex] = createSignal(0);
  return (
    <section class="widget carousel">
      <h2>Examples in pictures</h2>
      <img src={pictures[index()]} alt={`Example ${index() + 1}`} />
      <p>Image {index() + 1} of 2</p>
      <button onClick={() => setIndex((index() + 1) % pictures.length)}>Next image</button>
    </section>
  );
}
